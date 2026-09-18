import { createFileRoute } from "@tanstack/react-router";
import { GridWiseDashboard } from "../components/GridWiseDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridWise — Smart Campus Energy Dashboard" },
      {
        name: "description",
        content:
          "Monitor operator directives, energy schedules, costs, and constraint validation for the GridWise smart campus.",
      },
      { property: "og:title", content: "GridWise — Smart Campus Energy Dashboard" },
      {
        property: "og:description",
        content: "A transparent 24-hour smart campus energy optimization dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <GridWiseDashboard />;
}
