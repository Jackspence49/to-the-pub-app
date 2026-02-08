// Time parsing and formatting utilities

//Parse various time formats into Date objects
export const parseTimeToken = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp);
  }

  const amPmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2] ?? '0');
    const meridian = amPmMatch[4]?.toLowerCase();
    if (meridian === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridian === 'am' && hours === 12) {
      hours = 0;
    }
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }
    if (hours > 23 || minutes > 59) {
      return null;
    }
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  return null;
};

//Format closing time label for display
export const formatClosingTimeLabel = (closesAt?: string): string | null => {
  if (!closesAt) {
    return null;
  }

  const parsed = parseTimeToken(closesAt);
  if (!parsed) {
    return closesAt;
  }

  let hours = parsed.getHours();
  const minutes = parsed.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';

  if (hours === 0) {
    hours = 12;
  } else if (hours > 12) {
    hours -= 12;
  }

  const minutesPart = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : '';
  return `${hours}${minutesPart} ${period}`;
};