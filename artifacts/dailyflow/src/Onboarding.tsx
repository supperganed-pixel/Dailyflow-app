import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Icon, Label, useTheme } from "./ui";

const steps = [
  {
    icon: "plus" as const,
    title: "Capture what is on your mind",
    body: "Tap the + button to save a task, thought, link, or note. You can add details and a date when you are ready.",
  },
  {
    icon: "inbox" as const,
    title: "Review your Inbox",
    body: "New captures wait in Inbox. Open one to choose whether it needs action, a follow-up, or a place in your notes.",
  },
  {
    icon: "sun" as const,
    title: "See what matters today",
    body: "Today brings due tasks and important items together. Complete, snooze, or edit them as your day changes.",
  },
  {
    icon: "folder" as const,
    title: "Keep your space private",
    body: "Use Files for documents and images. Your signed-in account keeps cloud items private, and Settings lets you export a backup.",
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  return (
    <View style={{ gap: 22 }}>
      <View
        style={{
          padding: 24,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.surface,
          gap: 20,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: c.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={step.icon} size={27} color={c.brand} />
        </View>
        <Label small muted>
          STEP {index + 1} OF {steps.length}
        </Label>
        <Text
          accessibilityRole="header"
          style={{ color: c.ink, fontSize: 24, lineHeight: 31, fontWeight: "600" }}
        >
          {step.title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 16, lineHeight: 25 }}>
          {step.body}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {steps.map((item, stepIndex) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={`Go to tutorial step ${stepIndex + 1}`}
            accessibilityState={{ selected: stepIndex === index }}
            onPress={() => setIndex(stepIndex)}
            style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
          >
            <View
              style={{
                height: 5,
                borderRadius: 3,
                backgroundColor: stepIndex === index ? c.brand : c.line,
              }}
            />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {index > 0 && (
          <Button title="Back" onPress={() => setIndex(index - 1)} />
        )}
        <Button
          title={index === steps.length - 1 ? "Start using DailyFlow" : "Next"}
          primary
          onPress={() =>
            index === steps.length - 1 ? onDone() : setIndex(index + 1)
          }
        />
        <Button title="Skip guide" onPress={onDone} />
      </View>
    </View>
  );
}
