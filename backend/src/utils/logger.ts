type LogFields = Record<string, unknown>;

function line(level: string, message: string, fields?: LogFields): string {
  const base = `${new Date().toISOString()} [${level}] ${message}`;
  return fields ? `${base} ${JSON.stringify(fields)}` : base;
}

export const logger = {
  info(message: string, fields?: LogFields) {
    console.log(line("INFO", message, fields));
  },
  warn(message: string, fields?: LogFields) {
    console.warn(line("WARN", message, fields));
  },
  error(message: string, error: unknown, fields?: LogFields) {
    const errFields =
      error instanceof Error
        ? { errorMessage: error.message, stack: error.stack, ...fields }
        : { error, ...fields };
    console.error(line("ERROR", message, errFields));
  },
};
