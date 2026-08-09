/**
 * 全画面共通の「もどる」。ネイティブヘッダは使わず（タップ領域が小さい）、
 * 画面上部に大きなボタンとして置く（REQUIREMENTS §4.1 タップターゲット48dp以上）。
 */
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { SecondaryButton } from '@/components/secondary-button';

export function BackButton() {
  const router = useRouter();
  return <SecondaryButton icon={ArrowLeft} label="もどる" onPress={() => router.back()} />;
}
