import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, View } from "react-native";
import { Button, Label, s } from "../ui";
import { useReducedMotion } from "../appearance";

/** Swipes reveal actions; an explicit tap commits them. Buttons remain available to keyboard and screen readers. */
export function TaskMotion({ children, onComplete, onTomorrow, onFocus, done = false }: {
  children: (complete: () => void, completing: boolean) => React.ReactNode;
  onComplete: () => void; onTomorrow?: () => void; onFocus?: () => void; done?: boolean;
}) {
  const reduced = useReducedMotion();
  const [actions, setActions] = useState(false);
  const [completing, setCompleting] = useState(false);
  const lock = useRef(false);
  const motion = useRef(new Animated.Value(1)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const callback = useRef(onComplete); callback.current = onComplete;
  useEffect(() => () => { motion.stopAnimation(); drag.stopAnimation(); }, [motion, drag]);
  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 22 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderMove: (_, g) => drag.setValue(Math.max(-48, Math.min(48, g.dx / 3))),
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 42) setActions(true); drag.setValue(0); },
    onPanResponderTerminate: () => drag.setValue(0),
  })).current;
  function complete() {
    if (lock.current) return;
    if (done || reduced) { callback.current(); return; }
    lock.current = true; setCompleting(true);
    Animated.sequence([
      Animated.timing(motion, { toValue: 0.97, duration: 110, useNativeDriver: true }),
      Animated.spring(motion, { toValue: 1, speed: 22, bounciness: 7, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) { callback.current(); setCompleting(false); lock.current = false; }
    });
  }
  return <View style={{ gap: 8 }}>
    <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: drag }, { scale: motion }] }}>{children(complete, completing)}</Animated.View>
    {completing && <Label small>✓ Completed</Label>}
    <View style={s.wrap}>
      <Button title={actions ? "Hide actions" : "Quick actions"} icon="more-horizontal" onPress={() => setActions(!actions)} />
      {actions && <><Button title={done ? "Reopen" : "Complete"} onPress={complete} disabled={completing} />{!done && onTomorrow && <Button title="Tomorrow" icon="calendar" onPress={() => { setActions(false); onTomorrow(); }} />}{!done && onFocus && <Button title="Add to Focus" icon="star" onPress={() => { setActions(false); onFocus(); }} />}</>}
    </View>
  </View>;
}
export function Reveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion(); const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => { const animation = Animated.timing(opacity, { toValue: open ? 1 : 0, duration: reduced ? 0 : 180, useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [open, reduced, opacity]);
  return open ? <Animated.View style={{ opacity, gap: 10, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>{children}</Animated.View> : null;
}

