<!-- Reviewed by OpenAI Codex (gpt-6-luna) | Session ID: 01a17dc4-696d-7f03-94a0-2ab68db3d93e | Timestamp: 2026-10-27T23:31:23+09:00 -->

# Architecture & Security Review — `DESIGN_OPUS55.md`

**対象:** SeatedConductor MR  
**レビュー範囲:** 提示された `DESIGN_OPUS55.md` の内容  
**判定:** **実装開始前に必須修正が必要**

本設計は、手だけで完結する操作、オフライン動作、アクセシビリティ評価、同意を伴うエージェント操作を明確な目標にしています。一方で、現状は「Quest上で動く体験」「任意のPythonサービス」「外部MCPクライアント」の境界が曖昧です。複数の仕様は同時には成立せず、認証・同意・オフライン要件の実装も不十分です。特に、QuestブラウザからHMAC認証付きPython APIへ接続する方法、MCP over HTTPのプロトコル適合性、外部MCP経由の適用同意、Devpost提出物の要件を解決する必要があります。

また、設計中にある「特別賞」「Best New Productivity Experience」等の賞名・応募条件・審査基準は、Devpost上の最終規則に照合されていません。機能が存在することだけでは、賞への適格性や受賞可能性を示しません。

## 重大な指摘

### 1. QuestブラウザとHMAC認証の認証モデルが成立していない

内部APIは、HMAC secret が設定された場合にHMAC認証を要求します。ブラウザのXRクライアントにはそのsecretを安全に格納できません。クライアントに同梱すれば抽出可能で、URLを開いた審査員に配布するAPI資格情報として機能しません。さらに、任意ホストのサービスへ公開すれば、secret保護とリクエスト認証を両立できません。

**必須対応:** デプロイ形態ごとに認証モデルを定義してください。クライアント内に共有secretを埋め込まないこと。審査時の静的クライアントはローカル実行を既定とし、外部APIに接続する場合は、信頼できるバックエンドが発行・検証する短命トークン等、実際に成立する方式を定義してください。ブラウザから送信する任意のHMAC署名値を認証境界として扱わないこと。

### 2. 「任意サービス不要」と「Python API必須」の体験フローが矛盾している

設計では、完全な体験はTypeScript側のローカルエンジンだけで実行できる一方、Copilotのシーケンスではクライアントが `POST /api/agent/plan` と `/execute` を呼び出します。Pythonサービスは任意と記載されていますが、APIがないとどのフローを使うのか、ブラウザ内のプランナーとPythonエンジンがどの状態を共有するのかが定義されていません。

**必須対応:** ブラウザ単独モードとPythonバックエンドモードの各々について、画面遷移、状態の所有者、計画・確認・適用・監査の実行場所を定義してください。オフライン時にネットワーク要求を待たずにローカル実装へ切り替える条件と、モード切替中に確認トークンや計画が失効する動作も指定してください。

### 3. MCP over HTTP は記載されたプロトコルと一致しない

設計は `/mcp` の単一リクエスト／レスポンスを「Simplified Streamable-HTTP profile」としていますが、HTTP transport のリクエストヘッダー、応答の許容形式、セッション処理、初期化後の要求処理などを定義していません。また「クライアントのversionをechoする」は不適切です。サーバーは、クライアントが提示した値をそのまま返すのではなく、サポートするプロトコルバージョンをネゴシエートしなければなりません。stdio の改行区切りJSON-RPCは、HTTP transportとは別のtransport仕様です。

**必須対応:** 使用するMCP仕様バージョンと実装するtransportを明記し、HTTPでは該当仕様の要求ヘッダー、初期化、セッション、通知、レスポンス規則に従ってください。制限した実装を採用する場合は、標準MCP互換をうたわず、互換範囲と非対応機能を明記してください。JSON-RPCエラーとtool-level `isError` の使い分けも、対象メソッド・入力エラーごとに規定してください。

### 4. MCP経由の「明示的ユーザー承認」は保証されていない

`apply_plan` のtool descriptionに「明示的な承認を得ること」と記述しても、MCPクライアントがその承認を得たことは検証できません。`confirmation_token` を外部エージェントへ返したあとに、そのエージェント自身が `apply_plan` を呼べる設計は、説明だけでは同意境界になりません。`require_headset_confirm=true` は記載されていますが、既定値、適用範囲、オフライン時の動作が指定されていません。

**必須対応:** 外部MCPクライアントからの適用は、信頼できる実ユーザー確認が検証されるまで常に保留すること。Quest連携時の確認はヘッドセット上で発生・検証し、tokenは確認対象のplan digest、run、ユーザー確認、期限、消費状態に結び付けてください。MCPで確認済みと主張するだけの呼び出しを承認として扱わないこと。

### 5. エージェント上限と処理ステップ定義が矛盾している

workflowに記載されたステップは、`INTENT`、`PLAN`、任意の`RESEARCH`、`COMPOSE`、`EVALUATE`、`PROPOSE`、`CONFIRM`、`APPLY`、`REFLECT`で、最大8ステップを超える可能性があります。`REVISE`の繰り返しをどう数えるかも不明です。一方、`AgentStep.name` には `CONFIRM` がなく、`AgentRun.status` と失敗・取消・期限切れの状態遷移も不足しています。

**必須対応:** 数える対象と上限を明示し、任意・再試行・修正ステップを含めても上限内に収まる決定的な状態機械を定義してください。モデルの応答待ち、research、再評価、ユーザー放置、XR終了時にどの状態へ遷移するかを規定してください。

### 6. パフォーマンス要件が測定基準を欠き、両立するか不明

「ロードから初音まで4秒未満」「72/90 fps」「<5秒でfull CLI demo」「全操作がリーチ範囲内」は、測定環境、試行回数、合否判定、許容誤差がありません。ネットワークAPI、Questブラウザの初回ロード、XRセッション開始、AudioWorklet起動を含む条件も区別されていません。性能劣化時の縮退動作も示されていません。

**必須対応:** Quest実機・ブラウザ・ビルド・ネットワークの条件を分け、p50/p95、試行数、ウォーム／コールド起動、音声開始の計測点を定義してください。性能指標が失敗した場合の品質縮退（描画、解析、音声、任意機能）と、UXを維持する最低条件を指定してください。

## 必須修正: 実装前に仕様化する項目

### アーキテクチャと競技要件

- [ ] Devpost公式ルールで、締切のタイムゾーンと時刻、応募資格、対象プラットフォーム、New Experienceの基準、選択可能なtrack、各賞の正式名称・適格条件を確認し、設計書に出典と確認日を記載する。締切表記は日付だけでなく公式の基準タイムゾーンで確定する。
- [ ] 「Productivity」を選ぶ根拠を、実際の主要操作と短時間で完結するユーザー課題に結び付ける。規則上の賞・trackと、単なる設計上の目標を区別する。
- [ ] 必須の提出物を列挙する。Devpost project description、デモ動画、公開可能な実行URLまたは配布物、ソースコード、インストール・起動手順、Quest互換性と動作条件、第三者API利用の説明、クレジット、プライバシー情報、提出者・チーム情報の確認を含め、各成果物の責任者と完成期限を設定する。
- [ ] 審査員がPythonサービスやAPIキーを持たずに、主要体験を最後まで再生できる手順を定義する。起動失敗・XR非対応ブラウザ・音声再生拒否・ハンドトラッキング非対応時の案内とデモ用フォールバックを決める。
- [ ] ブラウザローカル実行とバックエンド実行の正本となるデータ、モード間の挙動、同期有無、障害時の遷移を定義する。
- [ ] TypeScriptとPythonの「同一結果」の対象を限定する。浮動小数点、PRNG初期化、整数幅、丸め、文字列順序、Unicode正規化、canonical JSON、未指定値・nullの扱いを仕様化し、golden fixtureの形式とバージョンを定義する。

### API契約・信頼性・エラー処理

- [ ] 内部RESTの全endpointについて、認証を含むブラウザ実行可能な契約を定義する。CORS、`Origin`検証、HTTPS、CSRF対策、認可、トークン更新・失効、レート制限の主体と単位を指定する。秘密情報をクライアントに埋め込まない。
- [ ] 全APIのrequest/response schemaを独立して定義し、未知フィールド、欠落フィールド、型不一致、上限超過、空配列、NaN/Infinity、重複stem、Unicode、過大ネストの応答を扱う。HTTP statusとerror codeを全endpointで一貫させる。
- [ ] `SCMR_MODE=auto`、`live`、`simulate`の優先順位と、providerごとの独立した状態を定義する。1つのprovider障害が無関係な機能を止めないこと。liveが失敗した際にsimulatorへ切り替わる条件、ユーザー表示、監査記録、live modeでの失敗方針を明記する。
- [ ] HTTPリトライに総時間budgetを設定し、試行回数、backoff、jitter、`Retry-After`、中断、キャンセル、エンドツーエンドtimeoutの整合を保証する。記載された最大10秒の`Retry-After`待機が8秒の`http_timeout_s`とどのように整合するかを解決する。冪等でない処理を自動再試行しない。
- [ ] タイムアウト、DNS/TLS障害、接続切断、空応答、非JSON、誤ったContent-Type、サイズ超過、provider側rate limit、認証拒否、schema不一致、JSON途中切断のフォールバックを定義する。API障害が音声再生やローカル操作を停止しないこと。
- [ ] URL検証はprefix文字列判定で済ませない。パース済みscheme・host・portを検証し、リダイレクト時の再検証、private/link-local宛て禁止、loopbackテスト許可の範囲を指定してSSRFを防止する。
- [ ] providerのmodel ID、endpoint、認証方式、payload、response形式を、リリース時点の公式仕様と実応答fixtureで確認する。互換性を「OpenAI-compatible」とだけ仮定しない。YouCamは、契約・認証・データ処理条件を確認できない限りビルドから無効化する。

### MCP契約・同意・監査

- [ ] HTTPとstdioそれぞれのMCP transport適合性を決め、initialize、protocol version negotiation、notifications、`tools/list`、`tools/call`、HTTP headers、session lifecycle、`tools/call`のエラー形式を互換fixtureで確認する。
- [ ] 全toolのinput/output JSON Schemaを定義し、サイズ制限、タイムアウト、取消、エラー分類、結果の決定性を明記する。任意の`frames`バッチとresearch入力には独立した上限を設定する。
- [ ] MCPをネットワーク公開する場合の認証、認可、rate limit、Origin/Host検証、TLS、ログ・PII保護を定義する。`/mcp`のHMACを解決するまで外部公開を前提にしない。
- [ ] `plan_focus_block`と`apply_plan`を異なる権限として扱う。提案作成は状態変更なし、適用は実ユーザー確認が検証された後だけ許可する。期限切れ・二重redeem・別run・plan変更・別クライアントからのtoken利用を拒否する。
- [ ] 監査チェーンのハッシュ計算に含めるフィールド、canonicalization、時刻形式、順序、同時更新時の直列化、永続化、破損検出を指定する。ハッシュチェーンだけでは削除・末尾切詰め・管理者による再構築を防げないため、`tamper-evident`の保証範囲と信頼済みheadの保存方法を明記する。
- [ ] `actor`、`action`、`provider`、失敗理由の許可値を定義し、task labelやprovider応答などの自由文を監査ログに保存しない方針を決める。audit trailへのアクセス制御と保持期間を定義する。

### セキュリティ・プライバシー

- [ ] HTTPS providerへ送るデータを、送信項目・目的・保持・第三者処理ごとに明示する。`task_label`の短縮やメール・TEL番号・URLの正規表現置換だけではPII漏えい防止を保証しない。既定でtask内容を外部送信しない設計を採用する。
- [ ] providerの応答・研究結果を信頼できない入力として扱う。prompt injection、悪意あるURL、偽の引用、HTML/SVGスクリプト、巨大入力を拒否し、research factsが制御命令や自由なコードとして実行されないことを保証する。
- [ ] `cover_svg`を外部から返す・描画する場合は、スクリプト、イベント属性、外部参照、data URLを除去する。SVGをそのままDOMに挿入しない。
- [ ] `localStorage`の保存項目と削除方法、共有端末上のプライバシー、XSS発生時の露出を評価する。保存データを最小化し、セッションジャーナル・streaks・署名motifの保存期間とユーザーによる消去を定義する。
- [ ] `.env`読み込みにおけるパーミッション、symlink、重複キー、改行、引用符、環境変数優先順位を規定する。秘密情報・Authorization header・本文を例外、HTTPエラー、MCP応答、診断レポートへ含めない。
- [ ] `urllib`の応答、header、redirect、TLS検証を明示し、秘密情報がredirect先へ転送されないようにする。ユーザー設定可能なbase URLはSSRF境界として扱う。
- [ ] タスクラベル、音声、手の位置・速度・震え推定値を、保存・送信・分析する範囲を区別する。「no biometric retention」の対象と、実行時に保持するメモリ上のテレメトリ、メトリクス、監査digestの関係を明記する。

### XR操作・アクセシビリティ・音声

- [ ] 空間基準を統一する。設計はhead-anchored origin、`local-floor`、seated originを併記しているため、基準座標系、床原点から頭部原点への変換、シート高補正、tracking loss時の扱いを定義する。
- [ ] 0.55 mの「airplane seat」上限と、profileの0.61 mまで許す半径を統一する。手が届かない要素、姿勢差、車椅子・座面高、校正失敗時の安全な再配置を決め、CIがどの正規化後の位置を検査するかを定義する。
- [ ] `HandFrame`のjoint名、座標の単位・基準、`tracked=false`時のjoint内容、frame時刻の単調性、複数手の同期、WebXR joint欠損を規定する。
- [ ] Pinch・beat・dwell・palm-flipの閾値、ヒステリシス、One Euro filterの係数、フレーム欠落時の状態リセットを定義する。片手操作、利き手反転、震え、手の一時喪失、低フレームレート、入力競合の受け入れ基準を設定する。
- [ ] Dwell選択の時間とプロファイル間の整合を取る。API例に`dwell_select`しかなく、dataclassでは`dwell_ms`が必須であり、提案レスポンスのレイアウトには要素ごとの選択方法もありません。既定値とフィールドのoptional性を統一してください。
- [ ] AudioContextのユーザー操作による起動要件、XR sessionの開始・終了、OS音量、ヘッドホンなしの再生、AudioWorklet非対応時、AudioWorklet停止・復帰、AudioWorkletのlookaheadとスケジューラ遅延を仕様化する。
- [ ] Spatial audioとHRTFが無効・不明瞭な場合の音量と聴覚フィードバックを定義する。キャプション対象、タイミング、内容、字幕表示が操作を妨げないレイアウトを定義する。
- [ ] fatigue monitorの入力・判定と停止提案の基準を具体化する。健康状態を推測したり、運動を要求したりせず、休止・手の切替・片手操作へ切り替えられることを検証する。

### 音楽生成・時間モデル

- [ ] `Section.bars` と `focus_minutes`、`StemPattern.steps`の長さ、BPM、拍子、ループ時間の関係を定義する。例の合計64 barsを74 BPM・4/4で演奏した場合、約2分10秒であり、10分のfocus blockとどのように対応するか明記する。
- [ ] `StemPattern`の`bars_in_loop`がモデル表に定義されていない点を修正する。`steps`と`notes`が可変長の並列データなら、長さ、値、対応関係、空patternの扱いを指定する。
- [ ] MIDI note番号と同時発音数、音量、クリッピング、ステム間のバランス、パターン生成の音楽的品質基準を定義する。権利フリーの根拠、ライセンス、使用ライブラリ・音源の一覧を提出物に含める。
- [ ] セッションの一時停止、再開、XR session end、ブラウザ強制終了時の音声状態を指定する。`visibilitychange`と`XRSession end`だけに依存せず、ブラウザの終了・ストレージ書き込み失敗・音声再開制限を含む復旧手順を定義する。

### データモデル・入力上限

- [ ] `HandFrame[] ≤ 20,000`を「約110秒」とする計算は、両手90 Hzの前提では整合しない。1フレームの定義が片手か両手かを定め、最大フレーム数・時間・バイト数を再計算する。
- [ ] `Vec3`は有限値と範囲を検査し、正規化前後の座標値や丸め誤差を一貫して扱う。boolをintとして受け入れる等、Pythonの型判定上の境界ケースを排除する。
- [ ] `AgentStep.name`、`mode`、`provider`、`status`などのenumに実際の状態遷移を対応させる。`CONFIRM`、`cancelled`、`expired`、`aborted`の欠落を解消する。
- [ ] `ResearchFact.source_url`ではHTTPSに加えて認証情報付きURL、内部IP、過度に長いURL、リダイレクト、追跡パラメータをどう扱うか定義する。
- [ ] 全入力にネスト深度、総バイト数、文字列長、要素数の上限を設ける。HTTP/MCPのpayload制限を、モデル層のリスト上限と同じ値にする。

### 決定性・テスト・リリース証跡

- [ ] シミュレーションの「bit-identical」を成立させるため、PRNGと各乱数消費順を固定し、PythonとTypeScriptで同一の整数演算・overflow・float処理を規定する。時刻、スレッド順、環境依存値、OS乱数を決定的出力に混入させない。
- [ ] 合成テレメトリにPoisson・pink noiseを使う場合、乱数seed、サンプリング方法、生成順を仕様化する。fixtureを固定し、同じ入力からイベント・metrics・audit digestが同じ結果になることを確認する。
- [ ] 必須の異常系fixtureを定義する：provider timeout、429と`Retry-After`、5xx、無効JSON、schema違反、API key欠落、片手・両手喪失、120 ms dropout、短い・長いbatch、tremor、追跡復帰、confirmation token再利用・期限切れ、XR終了、localStorage失敗。
- [ ] ハンド操作の決定的再生試験に、入力trajectory、フレーム時刻、期待gesture、許容レイテンシ、誤検出・見逃し基準を含める。テスト用のseedだけでなく、期待結果も固定する。
- [ ] アクセシビリティ評価は、profileの各要件と出力layoutの違反を個別に検査する。`reach_compliance == 1.0`だけでは判定できない。色、低モーション、片手到達、dwell、字幕、震え補正の検査項目を定義する。
- [ ] parity testでは、PythonとTypeScriptの全ドメインfixtureを比較する。浮動小数点比較の許容差、digest対象、仕様バージョンの不一致を検出する方法を決める。
- [ ] デプロイ成果物を再現できるよう、IWSDKテンプレートの取得元・バージョン、lockfile、node/Pythonバージョン、ビルド設定、外部APIの契約fixtureを固定する。CIでQuest向けビルドが実際に生成され、公開URLから読み込めることを検証する。
- [ ] `artifacts/report.md`、CI badge、run hashを提出証跡とするなら、再生成コマンド、データ出典、実機測定の有無、模擬データの明示を定義する。シミュレーション値を実機性能測定として提示しない。
- [ ] リリース前にAPIキーなし、ネットワーク遮断、XRセッション開始拒否、手トラッキング利用不可の各条件で、審査員向け手順を通せる受入基準を設ける。

## Mandatory Fixes for Implementation (Sakura `preview/Kimi-K2.7-Code`)

- [ ] **ブラウザ認証を設計し直す:** HMAC secretをXRクライアントに含めない。ローカルモードと、信頼できるバックエンドを使う場合の認証・認可を分ける。
- [ ] **オフラインの主要フローを確定する:** Python APIがない状態でintent選択から提案・確認・適用・undoまで実行可能にし、API障害時も待ち続けない。ブラウザとPythonの正本データを決める。
- [ ] **MCP transportを標準に合わせる:** MCP over HTTPのハンドシェイク、version negotiation、headers、session、通知、エラーを仕様化し、stdioと混同しない。サポート範囲を互換試験で固定する。
- [ ] **適用同意を強制する:** MCP tool descriptionだけを承認とみなさない。確認対象のplan digestに結び付いた一回限りの短命tokenを発行し、Quest側での明示的確認が確認されるまで`apply_plan`を拒否する。
- [ ] **プロバイダー障害を安全に縮退させる:** エンドツーエンドのtimeout budget、429対応、冪等性、schema検証、キャンセル、mode別fallbackとユーザー表示を実装仕様にする。失敗してもローカルの音楽体験を継続する。
- [ ] **API契約とデータモデルを揃える:** 内部API例の欠落・optional性、`dwell_ms`、`HandFrame`数と時間、`AgentStep.name`、sectionとpattern長、HTTP statusとerror envelopeを一つの検証可能なschemaに統合する。
- [ ] **レイアウトと座標系を揃える:** 0.55 mと0.61 mの矛盾を解消し、`local-floor`・着座原点・頭部原点・シート高の変換と、校正失敗時の処理を定義する。
- [ ] **監査とプライバシーの保証範囲を限定・実装する:** task label等の外部送信・保存を最小化し、監査digestの対象を明示する。ハッシュチェーンだけで改ざん・削除防止を保証しない。
- [ ] **XRと音声の必須フォールバックを実装する:** AudioContext起動拒否、XR開始失敗、tracking dropout、ブラウザ復帰、ストレージ失敗に対するユーザー案内と復旧を含め、実際のQuestブラウザで受け入れ試験を行う。
- [ ] **決定的fixtureと異常系fixtureを固定する:** PRNG、canonical JSON、Python/TypeScript演算の仕様を固定し、golden結果だけでなくprovider障害、手追跡異常、token再利用、XR終了を含む再生試験を作る。
- [ ] **Devpost提出物・適格性・計測証跡を確定する:** 公式ルールと正式賞名を確認し、動画、実行URL、README、クレジット、プライバシー説明、実機測定の範囲を締切前に完了できる計画へ落とし込む。

**実装ゲート:** 上記の認証境界、オフライン実行経路、MCP適合性、適用同意、入力schema、Devpost提出要件を確定するまで、外部API連携・MCP公開・賞適格性の主張を完成仕様として扱わない。
