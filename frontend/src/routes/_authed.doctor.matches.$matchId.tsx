import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/doctor/matches/$matchId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/doctor/matching/$matchId",
      params: { matchId: params.matchId },
    });
  },
});
