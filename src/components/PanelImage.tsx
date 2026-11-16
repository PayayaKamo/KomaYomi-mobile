import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { PanelRect } from '../shared/types';
import { loadImageSize } from '../lib/imageSize';

/**
 * One page image, optionally cropped to a normalized panel rectangle.
 *
 * Panel crops are rendered by scaling the whole image so the requested rectangle
 * fills the box, then shifting it into place; the intrinsic size is read from the
 * image itself because page data does not carry pixel dimensions.
 */
export function PanelImage({
  uri,
  rect,
  style,
}: {
  uri: string;
  rect: PanelRect | null;
  style?: StyleProp<ViewStyle>;
}) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [intrinsic, setIntrinsic] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    loadImageSize(uri).then(size => {
      if (alive) setIntrinsic(size);
    });
    return () => {
      alive = false;
    };
  }, [uri]);

  const crop =
    rect && intrinsic && box && rect.w > 0 && rect.h > 0
      ? (() => {
          const scale = Math.min(
            box.width / (rect.w * intrinsic.width),
            box.height / (rect.h * intrinsic.height),
          );
          const imageWidth = intrinsic.width * scale;
          const imageHeight = intrinsic.height * scale;
          return {
            width: imageWidth,
            height: imageHeight,
            left: (box.width - rect.w * imageWidth) / 2 - rect.x * imageWidth,
            top: (box.height - rect.h * imageHeight) / 2 - rect.y * imageHeight,
          };
        })()
      : null;

  const cropStyle: ImageStyle | null = crop
    ? {
        position: 'absolute',
        left: crop.left,
        top: crop.top,
        width: crop.width,
        height: crop.height,
      }
    : null;

  return (
    <View
      style={[styles.imageBox, style]}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox(previous =>
          previous &&
          Math.abs(previous.width - width) < 1 &&
          Math.abs(previous.height - height) < 1
            ? previous
            : { width, height },
        );
      }}
    >
      {cropStyle ? (
        <Image source={{ uri }} style={cropStyle} fadeDuration={0} />
      ) : (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          fadeDuration={0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  imageBox: { flex: 1, width: '100%', overflow: 'hidden' },
});
