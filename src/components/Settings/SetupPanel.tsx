import { useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "../../lib/supabase";

interface SetupPanelProps {
  session: Session | null;
  onMessage: (value: string) => void;
}

export default function SetupPanel({ session, onMessage }: SetupPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    onMessage(
      error
        ? error.message
        : "Supabase에 로그인했습니다. 이제 업로드 데이터가 클라우드에 저장됩니다."
    );
  }

  async function signUp() {
    if (!supabase) return;
    const { error } = await supabase.auth.signUp({ email, password });
    onMessage(
      error
        ? error.message
        : "가입 요청을 보냈습니다. 이메일 확인 설정에 따라 인증 후 로그인하세요."
    );
  }

  return (
    <section className="panel setup">
      <div className="panel-heading">
        <div>
          <h2>Supabase 연결</h2>
          <p>개인 판매 데이터를 보호하기 위해 로그인 사용자만 자신의 데이터를 읽고 쓰도록 설계되어 있습니다.</p>
        </div>
      </div>
      <ol>
        <li>Supabase 프로젝트를 만든 뒤 <code>supabase/schema.sql</code>을 SQL Editor에서 실행합니다.</li>
        <li><code>.env.example</code>을 <code>.env.local</code>로 복사하고 Project URL and Publishable key를 입력합니다.</li>
        <li>앱을 다시 실행한 뒤 아래에서 가입 및 로그인합니다.</li>
      </ol>
      {!hasSupabaseConfig ? (
        <div className="empty">환경 변수가 아직 없습니다. 현재는 로컬 시험 모드로 동작합니다.</div>
      ) : session ? (
        <div className="signed-in">
          <p>
            <b>{session.user.email}</b> 계정으로 연결되어 있습니다.
          </p>
          <button type="button" onClick={() => supabase?.auth.signOut()}>
            로그아웃
          </button>
        </div>
      ) : (
        <form className="auth" onSubmit={signIn}>
          <label>
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <div className="actions">
            <button className="primary" type="submit">
              로그인
            </button>
            <button type="button" onClick={signUp}>
              가입
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
