import { PlatformOverview } from '@/components/vilivyopotea/views';
import { DemoPreviewGate } from '@/components/vilivyopotea/demo-preview-gate';

export default function PlatformPage() {
  return (
    <DemoPreviewGate>
      <PlatformOverview />
    </DemoPreviewGate>
  );
}
