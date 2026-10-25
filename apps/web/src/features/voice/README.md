# features/voice [C2]

`LiveCaption` converts the authenticated recorder's `MediaStream` to 24 kHz mono PCM16, sends exact
80 ms binary frames to the same-origin `/v1/voice/live` proxy, and renders cumulative partials. No
provider credential or provider URL is shipped to the browser. Batch transcription remains
authoritative for the saved voice note.
