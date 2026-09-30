import { useAuth } from '@/hooks/useAuth';
import ItemCreateWizard from '@/components/ui/ItemCreateWizard';

export default function ItemCreatePage({ isRaw }) {
  const { accessToken, user } = useAuth();
  const employees = user?.employees || [];
  return (
    <ItemCreateWizard
      isRaw={isRaw}
      accessToken={accessToken}
      employees={employees}
      onDone={() => window.history.back()}
      onCancel={() => window.history.back()}
    />
  );
}
