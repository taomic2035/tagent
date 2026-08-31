# ============================================================
# Windows 引擎启动（llama.cpp + GGUF，TECH_STACK.md §四 R2 路线）
# 对照 Mac 版 start_llm.sh（MLX）：同一端口 8081、同一 OpenAI 兼容
# 接口，agent 代码零改动（NFR-7 引擎无关的落地）
#
# 用法:
#   .\start_llm.ps1                 # 前台启动（CPU 后端，AVX2 自动分派）
#   .\start_llm.ps1 -Detach         # 后台启动，日志写 D:\LLM\llama_server.log
#   .\start_llm.ps1 -Backend vulkan # Vulkan 后端（Intel 核显对照实验用）
#   .\start_llm.ps1 -Port 8082      # 换端口
# ============================================================
param(
  [string]$Model = "D:\LLM\models\Qwen3.5-4B-UD-Q4_K_XL.gguf",
  [int]$Port = 8081,
  [ValidateSet("cpu", "vulkan")]
  [string]$Backend = "cpu",
  [int]$Ctx = 16384,
  [switch]$Detach
)

$exe = "D:\LLM\llama-cpp\$Backend\llama-server.exe"
if (-not (Test-Path $exe)) {
  Write-Error "找不到 $exe —— 先按 SETUP.md「Windows 环境」一节安装 llama.cpp"
  exit 1
}
if (-not (Test-Path $Model)) {
  Write-Error "找不到模型 $Model —— 下载方式见 SETUP.md「Windows 环境」"
  exit 1
}

# --jinja 当前版本默认开启（tool calling 前提，仍显式写出便于阅读）
# --reasoning-format deepseek：把思考内容放 delta.reasoning_content，
#   client.ts 同时兼容 reasoning（MLX）与 reasoning_content（llama.cpp）
$llamaArgs = @(
  "-m", $Model,
  "--host", "127.0.0.1", "--port", $Port,
  "-c", $Ctx,
  "--jinja",
  "--reasoning-format", "deepseek"
)
if ($Backend -eq "vulkan") { $llamaArgs += @("-ngl", "99", "-fa", "on") }

if ($Detach) {
  $log = "D:\LLM\llama_server.log"
  $proc = Start-Process -FilePath $exe -ArgumentList $llamaArgs `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" `
    -PassThru -WindowStyle Hidden
  Write-Host "llama-server（$Backend）后台启动中，PID: $($proc.Id)，日志: $log"
} else {
  & $exe @llamaArgs
}
Write-Host "健康检查: curl http://127.0.0.1:$Port/health"
