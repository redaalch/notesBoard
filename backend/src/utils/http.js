export const extractBearerToken = (headerValue) => {
  if (typeof headerValue !== "string") return null;
  if (headerValue.slice(0, 7).toLowerCase() !== "bearer ") return null;
  const token = headerValue.slice(7).trim();
  return token.length > 0 ? token : null;
};
