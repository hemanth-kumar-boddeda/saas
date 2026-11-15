// SEC-02 approved platform-administrator bootstrap.
// The ONLY mechanism that may grant the "admin" role outside an existing admin's
// explicit updateUserRole call is the PLATFORM_ADMIN_EMAIL environment variable,
// evaluated server-side after a verified login (password or provider-verified
// identity). Registration never calls this. No e-mail literal exists in source;
// the value comes from the environment and is never echoed to clients.
export const maybeBootstrapPlatformAdmin = (email: string): boolean => {
  const bootstrapEmail = process.env.PLATFORM_ADMIN_EMAIL;
  if (!bootstrapEmail) return false;
  if (email.toLowerCase() !== bootstrapEmail.toLowerCase()) return false;
  // Caller persists the role change; we only decide.
  return true;
};
