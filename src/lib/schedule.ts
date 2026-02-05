import { DateTime } from "luxon";

const TZ = "America/New_York";
const CHANGE_MINUTE = 1; // 12:01am ET

export function getNextRoundChangeET() {
  const now = DateTime.now().setZone(TZ);

  // 00:01 today in ET
  const todayChange = now.startOf("day").plus({ minutes: CHANGE_MINUTE });

  // If it's before 00:01, next change is today at 00:01
  if (now < todayChange) return todayChange;

  // luxon weekday: Mon=1 ... Sun=7
  const wd = now.weekday;

  // Round windows:
  // Sun/Mon -> Tue
  // Tue/Wed -> Thu
  // Thu/Fri -> Sat
  // Sat -> Sun (new topic)
  let daysToAdd = 1;

  if (wd === 7 || wd === 1) daysToAdd = wd === 7 ? 2 : 1; // Sun->Tue, Mon->Tue
  else if (wd === 2 || wd === 3) daysToAdd = wd === 2 ? 2 : 1; // Tue->Thu, Wed->Thu
  else if (wd === 4 || wd === 5) daysToAdd = wd === 4 ? 2 : 1; // Thu->Sat, Fri->Sat
  else if (wd === 6) daysToAdd = 1; // Sat->Sun

  return now
    .plus({ days: daysToAdd })
    .startOf("day")
    .plus({ minutes: CHANGE_MINUTE });
}
