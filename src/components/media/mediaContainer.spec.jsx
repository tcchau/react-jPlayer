import React from 'react';
import expect, { createSpy, spyOn } from 'expect';
import { mount } from 'enzyme';

import { getJPlayers } from '../../util/common.spec';
import { defaultOptions, loopOptions } from '../../util/constants';
import { urlNotSupportedError } from '../../util/index';
import { setOption, pause } from '../../actions/actions';
import { __get__ } from './mediaContainer';

const uid = 'jPlayer-1';
const mapStateToProps = __get__('mapStateToProps');
const mapDispatchToProps = __get__('mapDispatchToProps');
const MediaContainer = __get__('MediaContainer');
const mockAudio = <audio className="@@test-media" />;
const mockVideo = <video className="@@test-media" />;
const getProps = state => ({
  ...getJPlayers(state).jPlayers[uid],
  setOption: createSpy(),
  pause: createSpy(),
});

const setup = (state, newProps, isAudio = true) => {
  const props = {
    ...getProps(state),
    ...newProps,
  };
  const wrapper = mount(
    <MediaContainer {...props}>
      {isAudio ? mockAudio : mockVideo}
    </MediaContainer>,
  );
  const instance = wrapper.instance();

  instance.currentMedia.currentTime = 90;
  instance.currentMedia.play = createSpy().andCall(() => {
    Object.defineProperty(instance, 'paused', { value: false });
  });
  instance.currentMedia.pause = createSpy().andCall(() => {
    Object.defineProperty(instance, 'paused', { value: true });
  });
  Object.defineProperty(instance.currentMedia, 'duration', { value: 250, configurable: true });
  Object.defineProperty(instance.currentMedia, 'buffered', {
    value: {
      length: 2,
      start: start => start,
      end: end => end,
    },
  });
  Object.defineProperty(instance.currentMedia, 'seekable', {
    value: {
      length: 22,
      end: end => end,
    },
  });

  return {
    wrapper,
    props,
    instance,
  };
};

describe('MediaContainer', () => {
  let dispatch;

  beforeEach(() => {
    dispatch = createSpy();
  });

  it('maps state', () => {
    const expected = mapStateToProps(getJPlayers(), { uid, children: mockAudio });

    expect(expected).toEqual({
      loop: loopOptions.OFF,
      showRemainingDuration: false,
      src: '',
      currentTime: 0,
      playHeadPercent: 0,
      paused: true,
      defaultPlaybackRate: defaultOptions.defaultPlaybackRate,
      playbackRate: 1.0,
      preload: 'metadata',
      volume: defaultOptions.volume,
      muted: false,
      autoplay: false,
      newTime: null,
      require: false,
      children: mockAudio,
      timeFormats: defaultOptions.timeFormats,
    });
  });

  it('dispatches setOption in mapDispatchToProps when called', () => {
    const key = 'test';
    const value = true;
    mapDispatchToProps(dispatch, { uid }).setOption(key, value);

    expect(dispatch).toHaveBeenCalledWith(setOption(key, value, uid));
  });

  it('dispatches pause in mapDispatchToProps when called', () => {
    const time = 30;
    mapDispatchToProps(dispatch, { uid }).pause(time);

    expect(dispatch).toHaveBeenCalledWith(pause({ time, uid }));
  });

  it('updates media on startup', () => {
    const media = {
      src: 'test.mp3',
      defaultPlaybackRate: 0.2,
      playbackRate: 0.2,
      preload: 'off',
      volume: 0.1,
      muted: true,
      autoplay: true,
    };
    const { props, instance } = setup({ ...media, loop: loopOptions.LOOP });

    Object.keys(media).forEach((key) => {
      expect(media[key]).toBe(instance.currentMedia[key],
        `Expected ${media[key]} to be ${instance.currentMedia[key]} for ${key}`);
    });
    expect(instance.currentMedia.loop).toBe(true,
      `Expected ${props.loop} to be ${instance.currentMedia.loop} for loop`);
    expect(props.setOption).toHaveBeenCalledWith('volumeSupported', true);
  });

  it('updates media when props change', () => {
    const sharedMedia = {
      src: 'test.mp3',
      defaultPlaybackRate: 0.2,
      playbackRate: 0.2,
      preload: 'off',
      volume: 0.1,
      muted: true,
      autoplay: true,
    };
    const { wrapper, props, instance } = setup({
      ...sharedMedia,
      loop: loopOptions.LOOP,
      newTime: 33,
    });

    wrapper.setProps(props);

    Object.keys(sharedMedia).forEach((key) => {
      expect(sharedMedia[key]).toBe(instance.currentMedia[key],
        `Expected ${sharedMedia[key]} to be ${instance.currentMedia[key]} for ${key}`);
    });
    expect(instance.currentMedia.loop).toBe(true,
      `Expected ${props.loop} to be ${instance.currentMedia.loop} for loop`);
    expect(instance.currentMedia.currentTime).toBe(33,
      `Expected ${props.newtime} to be ${instance.currentMedia.currentTime} for newtime`);
    expect(props.setOption).toHaveBeenCalledWith('newTime', null);
  });

  it('updates playHeadPercent when props change and seekable media', () => {
    const playHeadPercent = 44;
    const { wrapper, props, instance } = setup();

    wrapper.setProps(getProps({
      playHeadPercent,
    }));

    expect(instance.currentMedia.currentTime).toBe(9.24);
    expect(props.setOption).toHaveBeenCalledWith('currentPercentRelative', 44);
  });

  const pauseData = [
    { paused: true },
    { paused: false },
  ];

  it('sets the pause/play to current props', () => {
    pauseData.forEach((pauseDatum) => {
      const { wrapper, instance } = setup({ paused: !pauseDatum.paused });

      wrapper.setProps(getProps({
        paused: pauseDatum.paused,
      }));

      expect(instance.paused).toBe(pauseDatum.paused);
    });
  });

  it('updateMediaStatus updates status properties to correct values', () => {
    const { props, instance } = setup();

    instance.currentMedia.playbackRate = 0.35;

    instance.updateMediaStatus();

    expect(props.setOption).toHaveBeenCalledWith('durationText', '04:10');
    expect(props.setOption).toHaveBeenCalledWith('currentTimeText', '01:30');
    expect(props.setOption).toHaveBeenCalledWith('seekPercent', 8.4);
    expect(props.setOption).toHaveBeenCalledWith('currentPercentRelative', 428.57142857142856);
    expect(props.setOption).toHaveBeenCalledWith('currentPercentAbsolute', 36);
    expect(props.setOption).toHaveBeenCalledWith('currentTime', instance.currentMedia.currentTime);
    expect(props.setOption).toHaveBeenCalledWith('remaining', 160);
    expect(props.setOption).toHaveBeenCalledWith('duration', instance.currentMedia.duration);
    expect(props.setOption)
      .toHaveBeenCalledWith('playbackRate', instance.currentMedia.playbackRate);
  });

  it('updateMediaStatus sets seekPercent to 0 when media not seekable', () => {
    const { props, instance } = setup();
    Object.defineProperty(instance.currentMedia.seekable, 'length', { value: 0 });

    instance.updateMediaStatus();

    expect(props.setOption).toHaveBeenCalledWith('seekPercent', 0);
  });

  it('updateMediaStatus sets durationText correctly when showRemainingDuration', () => {
    const { props, instance } = setup({ showRemainingDuration: true });

    instance.updateMediaStatus();

    expect(props.setOption).toHaveBeenCalledWith('durationText', '-02:40');
  });

  it('updateMediaStatus sets durationText to 00:00 if time remaining is 0', () => {
    const { props, instance } = setup({ showRemainingDuration: true });

    Object.defineProperty(instance.currentMedia, 'duration', { value: 90 });
    instance.currentMedia.currentTime = 90;

    instance.updateMediaStatus();

    expect(props.setOption).toHaveBeenCalledWith('durationText', '00:00');
  });

  it('getSeekableEnd gets the end of the seekable time', () => {
    const { instance } = setup();
    const seekEnd = instance.getSeekableEnd();

    expect(seekEnd).toBe(instance.currentMedia.seekable.length - 1);
  });

  it('getCurrentPercentRelative doesn\'t get the current percent relative if not seekable', () => {
    const { instance } = setup();

    Object.defineProperty(instance.currentMedia.seekable, 'length', { value: 0 });

    const currentPercentRelative = instance.getCurrentPercentRelative();

    expect(currentPercentRelative).toBe(0);
  });

  it('onProgress event updates media status', () => {
    const onProgress = createSpy();
    const { props, instance } = setup(undefined, { onProgress });

    spyOn(instance, 'updateMediaStatus');

    instance.events.onProgress();

    const expected = [
      { start: 0, end: 0 },
      { start: 1, end: 1 },
    ];

    expect(props.setOption).toHaveBeenCalledWith('bufferedTimeRanges', expected);
    expect(onProgress).toHaveBeenCalled();
    expect(instance.updateMediaStatus).toHaveBeenCalled();
  });

  it('onTimeUpdate event updates media status', () => {
    const onTimeUpdate = createSpy();
    const { instance } = setup(undefined, { onTimeUpdate });

    spyOn(instance, 'updateMediaStatus');

    instance.events.onTimeUpdate();

    expect(onTimeUpdate).toHaveBeenCalled();
    expect(instance.updateMediaStatus).toHaveBeenCalled();
  });

  it('onDurationChange event updates media status', () => {
    const onDurationChange = createSpy();
    const { instance } = setup(undefined, { onDurationChange });

    spyOn(instance, 'updateMediaStatus');

    instance.events.onDurationChange();

    expect(onDurationChange).toHaveBeenCalled();
    expect(instance.updateMediaStatus).toHaveBeenCalled();
  });

  it('onSeeking event sets seeking to true', () => {
    const onSeeking = createSpy();
    const { props, instance } = setup(undefined, { onSeeking });

    instance.events.onSeeking();

    expect(onSeeking).toHaveBeenCalled();
    expect(props.setOption).toHaveBeenCalledWith('seeking', true);
  });

  it('onSeeked event sets seeking to false', () => {
    const onSeeked = createSpy();
    const { props, instance } = setup(undefined, { onSeeked });

    instance.events.onSeeked();

    expect(onSeeked).toHaveBeenCalled();
    expect(props.setOption).toHaveBeenCalledWith('seeking', false);
  });

  it('onPlay event sets paused to false', () => {
    const onPlay = createSpy();
    const { props, instance } = setup(undefined, { onPlay });

    instance.events.onPlay();

    expect(onPlay).toHaveBeenCalled();
    expect(props.setOption).toHaveBeenCalledWith('paused', false);
  });

  it('onEnded event updates media status', () => {
    const onEnded = createSpy();
    const onRepeat = createSpy();
    const { props, instance } = setup(undefined, { onEnded, onRepeat });

    spyOn(instance, 'updateMediaStatus');

    instance.events.onEnded();

    expect(instance.updateMediaStatus).toHaveBeenCalled();
    expect(props.pause).toHaveBeenCalledWith({ time: 0 });
    expect(onEnded).toHaveBeenCalled();
    expect(onRepeat).toNotHaveBeenCalled();
  });

  it('onEnded calls loop callback if looping', () => {
    const onRepeat = createSpy();
    const { instance } = setup({ loop: loopOptions.LOOP }, { onRepeat });

    instance.events.onEnded();

    expect(onRepeat).toHaveBeenCalled();
  });

  it('onError sets error to urlNotSupported', () => {
    const onError = createSpy();
    const { props, instance } = setup(undefined, { onError });

    instance.events.onError();

    expect(props.setOption)
      .toHaveBeenCalledWith('error', urlNotSupportedError(props.src));
    expect(onError).toHaveBeenCalled();
  });

  const renderData = [
    { video: true },
    { video: false },
  ];

  it('renders children with events passed in', () => {
    renderData.forEach((renderDatum) => {
      const { wrapper, instance } = setup(undefined, undefined, renderDatum.video);
      const childProps = wrapper.find('.@@test-media').props();

      Object.keys(instance.events).forEach((key) => {
        const event = instance.events[key];

        expect(event).toBe(childProps[key]);
      });
    });
  });
});