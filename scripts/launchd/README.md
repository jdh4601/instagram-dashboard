# 매일 아침 자동 리포트 (macOS launchd)

노트북을 로컬 서버로 두고, 매일 08:00에 인스타그램 계정을 자동 분석해 이메일 리포트를 발송한다.

## 사전 준비

1. **`.env` 설정** — `.env.example`를 참고해 아래 값을 채운다.
   ```
   CRON_SECRET=<openssl rand -hex 32 로 생성>
   RESEND_API_KEY=re_...
   REPORT_EMAIL_FROM=report@yourdomain.com   # Resend에서 인증한 도메인
   REPORT_EMAIL_TO=team@corp.com
   ```
   Instagram Access Token은 대시보드 `/settings`에서 이미 등록돼 있어야 한다.

2. **서버 상시 구동** — 리포트는 실행 중인 서버의 API를 호출하므로 서버가 떠 있어야 한다.
   ```bash
   docker compose up -d
   ```

## 설치

```bash
# 1) 스크립트 실행 권한
chmod +x scripts/daily-report.sh

# 2) plist 복사 (경로가 다르면 plist 안의 절대경로를 먼저 수정)
cp scripts/launchd/com.done.instagram-report.plist ~/Library/LaunchAgents/

# 3) 등록
launchctl load ~/Library/LaunchAgents/com.done.instagram-report.plist
```

## 절전 중에도 놓치지 않기 (중요)

`launchd`는 노트북이 **절전 상태면 08:00에 실행하지 못한다.** 두 가지 중 하나로 해결한다.

- **정해진 시각에 자동으로 깨우기 (권장)** — 매일 07:55에 깨운 뒤 08:00에 실행:
  ```bash
  sudo pmset repeat wakeorpoweron MTWRFSU 07:55:00
  ```
  (전원 연결 상태면 덮개를 닫아도 깨어난다.)

- **절전 방지** — 전원 연결 + 시스템 설정에서 자동 절전 끄기, 또는 `caffeinate`.

> `launchd`는 절전으로 놓친 작업을 깨어난 직후 한 번 실행해 주므로, `pmset` 웨이크와 함께 쓰면 대부분 안정적으로 발송된다.

## 동작 확인 / 로그

```bash
# 지금 즉시 한 번 실행 (스케줄 무관)
launchctl start com.done.instagram-report

# 로그 확인
tail -f data/daily-report.log

# 스크립트 단독 테스트
PROJECT_DIR="$PWD" bash scripts/daily-report.sh
```

## 제거

```bash
launchctl unload ~/Library/LaunchAgents/com.done.instagram-report.plist
rm ~/Library/LaunchAgents/com.done.instagram-report.plist
sudo pmset repeat cancel   # 자동 웨이크 해제
```

## VPS로 이전할 때

스케줄러만 교체하면 된다 — launchd 대신 crontab:
```cron
0 8 * * * /path/to/scripts/daily-report.sh >> /path/to/data/daily-report.log 2>&1
```
나머지(리포트 로직·라우트·Resend)는 그대로 동작한다.
