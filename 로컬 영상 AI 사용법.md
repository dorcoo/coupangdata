# 로컬 영상 AI 사용법

## 실행

`로컬 영상 AI 실행.cmd`를 더블클릭합니다. 검은 창을 닫으면 AI도 종료됩니다.

브라우저가 자동으로 열리지 않으면 `http://127.0.0.1:8188`에 접속합니다.

## 첫 영상 만들기

1. ComfyUI에서 **Workflow → Browse Templates**를 엽니다.
2. Video의 **Wan 2.1 Text to Video 1.3B** 템플릿을 선택합니다.
3. 긍정 프롬프트를 원하는 장면 설명으로 바꿉니다.
4. 처음에는 크기를 `640 × 360`, 길이를 약 3초로 설정합니다.
5. **Run** 버튼을 누릅니다.

완성 영상은 `C:\AI\local-video-ai\ComfyUI\output` 폴더에 저장됩니다.

## RTX 5060 8GB 권장 설정

- 한 번에 한 작업만 생성
- 360p 또는 480p 사용
- 3~5초부터 시작
- 메모리 부족 오류가 나면 해상도나 프레임 수를 낮춤
- 생성 중에는 GPU를 많이 쓰는 게임이나 프로그램을 종료

## 설치 위치

- 프로그램: `C:\AI\local-video-ai\ComfyUI`
- 모델: `C:\AI\local-video-ai\ComfyUI\models`
- 결과: `C:\AI\local-video-ai\ComfyUI\output`
