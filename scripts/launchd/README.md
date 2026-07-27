# 매일 아침 자동 리포트 스케줄링

실행 중인 로컬 서버를 매일 08:00에 호출해 인스타그램 계정을 자동 분석하고 이메일 리포트를
발송한다. 아래 설치 절차는 macOS launchd 기준이며, Linux와 Windows 대안은 문서 끝에 있다.

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

`com.example.instagram-report.plist.template`을 복사한 뒤 자리표시자
(`__LABEL__`, `__PROJECT_DIR__`)를 본인 값으로 바꿔서 설치한다.

```bash
# 1) 스크립트 실행 권한
chmod +x scripts/daily-report.sh

# 2) 템플릿 → 실제 plist 생성 (라벨과 절대경로 치환)
LABEL="com.$(whoami).instagram-report"
sed -e "s|__LABEL__|$LABEL|g" -e "s|__PROJECT_DIR__|$PWD|g" \
  scripts/launchd/com.example.instagram-report.plist.template \
  > "$HOME/Library/LaunchAgents/$LABEL.plist"

# 3) 등록
launchctl load "$HOME/Library/LaunchAgents/$LABEL.plist"
```

> 아래 예시 명령의 `com.example.instagram-report`는 위에서 정한 `$LABEL`로 바꿔서 쓰세요.

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
launchctl start com.example.instagram-report

# 로그 확인
tail -f data/daily-report.log

# 스크립트 단독 테스트
PROJECT_DIR="$PWD" bash scripts/daily-report.sh
```

## 제거

```bash
launchctl unload ~/Library/LaunchAgents/com.example.instagram-report.plist
rm ~/Library/LaunchAgents/com.example.instagram-report.plist
sudo pmset repeat cancel   # 자동 웨이크 해제
```

## Linux / VPS (cron)

스케줄러만 교체하면 된다 — launchd 대신 crontab:
```cron
0 8 * * * /path/to/scripts/daily-report.sh >> /path/to/data/daily-report.log 2>&1
```
나머지(리포트 로직·라우트·Resend)는 그대로 동작한다.

## Windows (작업 스케줄러)

`daily-report.sh`는 Bash 스크립트이므로 WSL 또는 Git Bash에서 실행한다. 작업 스케줄러에 매일
08:00 트리거를 만들고 다음과 같이 등록한다(경로는 설치 위치에 맞게 변경).

```text
Program: C:\\Windows\\System32\\wsl.exe
Arguments: bash -lc 'cd /path/to/instagram-dashboard && ./scripts/daily-report.sh >> data/daily-report.log 2>&1'
```

어느 운영체제든 PC가 절전/종료 상태이면 정시 실행되지 않을 수 있다. 항상 켜진 서버나 호스팅
플랫폼을 쓸 때는 해당 플랫폼의 cron 기능으로 같은 POST 요청을 예약하면 된다.
