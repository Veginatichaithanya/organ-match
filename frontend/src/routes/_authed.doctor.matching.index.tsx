import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/doctor/matching/")({
  component: RedirectToDoctorMatches,
});

function RedirectToDoctorMatches() {
  return <Navigate to="/doctor/matches" replace />;
}
