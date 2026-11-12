import { LoginForm } from '../../components/login-form';
import { isConfigured } from '../../lib/google';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  return <LoginForm googleReady={isConfigured()} initialError={params?.error || ''} />;
}
