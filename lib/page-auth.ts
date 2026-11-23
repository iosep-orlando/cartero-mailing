import { redirect } from "next/navigation";
import { AuthError, requireTenant, type TenantCaller } from "./auth";

/** Para las páginas del servidor: el tenant de la sesión, o al login. */
export async function pageTenant(): Promise<TenantCaller> {
  try {
    return await requireTenant();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.status === 401 ? "/login" : "/onboarding");
    throw error;
  }
}
