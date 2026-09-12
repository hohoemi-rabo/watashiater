/**
 * 画面上部に固定する操作行（チケット36）。「戻る」と、深い画面では「ホーム」を並べる。
 *
 * 実装の判断：
 * - **スクロールの外に置くこと**。以前は BackButton をスクロールの中に入れていたので、
 *   長い画面（回答・自分史・みんなに見せる・設定）で下まで読むと戻る手段が画面から消え、
 *   Android の戻るジェスチャーを知らない人には行き止まりに見えた（2026-09-12 ユーザー指摘）
 * - **深さは props で明示する**（ナビゲーション状態から推測しない）。どの画面が深いのかが
 *   コードを読んで分かるほうがよい。`showHome` を渡すのは2階層目より深い画面だけ
 * - 「ホーム」は `dismissAll()`＝スタックの根へ戻す。行き先を `/` と決め打ちにしない：
 *   **書き手の根は `/`、家族としてだけ使っている人の根は `/family`**（_layout.tsx の AuthGate が
 *   subject を持たない人を `/family` へ replace する）。根に戻す指示にしておけば両方で正しくなる
 * - `showHome` が無いときは戻るが横幅いっぱい＝これまでの見た目を変えない
 */
import { useRouter } from 'expo-router';
import { ArrowLeft, House } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/secondary-button';
import { spacing } from '@/constants/tokens';

export function ScreenHeader({ showHome }: { showHome?: boolean }) {
  const router = useRouter();

  const goHome = () => {
    // 積み上がった画面をすべて閉じて根へ。閉じるものが無い場合だけ行き先を指定する
    if (router.canDismiss()) {
      router.dismissAll();
      return;
    }
    router.replace('/');
  };

  return (
    <View style={styles.row}>
      <View style={styles.slot}>
        <SecondaryButton icon={ArrowLeft} label="戻る" onPress={() => router.back()} />
      </View>
      {showHome ? (
        <View style={styles.slot}>
          <SecondaryButton icon={House} label="ホーム" onPress={goHome} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  // 2つ並ぶときは半分ずつ。1つのときは横幅いっぱい（今までと同じ姿）
  slot: {
    flex: 1,
  },
});
