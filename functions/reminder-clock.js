'use strict';

/* The clock the scheduled reminder thinks in. No firebase-functions import on purpose.
 *
 * These are the only parts of the reminder worth unit-testing - whether 05:40 means the same
 * thing to a family in Chicago as the server's UTC clock thinks it does - and the test has to
 * run on CI, where functions/node_modules is not installed. Keeping them free of the cloud
 * wiring is what makes that possible, and it is the honest split anyway: this is arithmetic,
 * the other file is plumbing.
 */

/* Wall-clock minutes since midnight and the calendar date, in the family's own timezone. */
function localNow(timeZone, at = new Date()){
  const tz = timeZone || 'UTC';
  let parts;
  try{
    parts = new Intl.DateTimeFormat('en-CA', {timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})
      .formatToParts(at).reduce((o, p) => (o[p.type] = p.value, o), {});
  }catch{ return null; }
  if(!parts.year || !parts.hour) return null;
  const hour = Number(parts.hour === '24' ? '0' : parts.hour), minute = Number(parts.minute);
  if(!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return {date: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + minute};
}

const toMinutes = t => {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

const to12 = t => {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m)
    ? `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
    : String(t || '');
};

module.exports = {localNow, toMinutes, to12};
