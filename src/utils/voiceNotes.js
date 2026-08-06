// ============================================================
// Voice notes - which roles get the "Voice note + Transcribe" widget
// ============================================================
//
// This is the SINGLE place that decides which roles can record a voice note
// and transcribe it (in lead quick actions, etc.). To turn the feature on for
// more roles, just add their short code to the list below - e.g. add 'TC',
// 'COL', 'ACCT'. Nothing else needs to change.
//
//   Role short codes: SA, ADM, SH, SM, TC, COL, ACCT, AM, CE, RM, ...

export const VOICE_NOTE_ROLES = ['SM', 'SH'];

// True when the given role short code may use voice notes + transcribe.
export const canUseVoiceNotes = (roleCode) => VOICE_NOTE_ROLES.includes(roleCode);
