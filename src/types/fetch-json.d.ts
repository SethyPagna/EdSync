interface Body {
  // Keep Fetch JSON permissive; route-specific code narrows payloads where safety matters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(): Promise<any>;
}
