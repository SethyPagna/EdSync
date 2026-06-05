import StudioWorkspace from "@/components/studio/StudioWorkspace";

export const metadata = {
  title: "Slides",
  description: "Design slide decks, transitions, animations, and presentations in EdSync.",
};

export default function SlidesPage() {
  return <StudioWorkspace initialKind="slide" />;
}
