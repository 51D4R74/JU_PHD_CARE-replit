import type { CurrentPulseState, PulseSubmissionAnswer } from "@shared/pulse-survey";
import { RELATIONAL_MONTHLY_PULSE } from "@shared/pulse-survey";
import { apiRequest } from "./queryClient";

interface SubmitRelationalPulseParams {
  readonly userId: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly answers: readonly PulseSubmissionAnswer[];
}

export async function fetchCurrentRelationalPulse(userId: string): Promise<CurrentPulseState> {
  const response = await apiRequest("GET", `/api/pulses/user/${userId}/current`);
  return response.json() as Promise<CurrentPulseState>;
}

export async function submitRelationalPulse({
  userId,
  windowStart,
  windowEnd,
  answers,
}: Readonly<SubmitRelationalPulseParams>): Promise<void> {
  await apiRequest("POST", "/api/pulses", {
    userId,
    pulseKey: RELATIONAL_MONTHLY_PULSE.key,
    pulseVersion: RELATIONAL_MONTHLY_PULSE.version,
    windowStart,
    windowEnd,
    answers,
  });
}