// Preserve as duas primeiras linhas do seu Scriptable, inclusive const API=...,KEY=...,PAINEL=...
// Substitua TODO o código abaixo da linha 2 por este arquivo. Não contém chave.
const mdArquivos = FileManager.local();
const mdNome = "meu-dinheiro-widget-" + encodeURIComponent(PAINEL.replace(/[#?].*$/, "")) + ".js";
const mdCache = mdArquivos.joinPath(mdArquivos.documentsDirectory(), mdNome);
let mdExecutar;
try {
  const mdBase = PAINEL.replace(/[#?].*$/, "").replace(/\/?$/, "/");
  const mdPedido = new Request(mdBase + "widget.js?v=" + Date.now());
  mdPedido.timeoutInterval = 10;
  const mdCodigo = await mdPedido.loadString();
  if (!mdCodigo.startsWith("// meu-dinheiro-widget:v1") || (mdPedido.response && mdPedido.response.statusCode !== 200)) throw new Error("Widget indisponível");
  mdExecutar = new Function("API", "KEY", "PAINEL", mdCodigo);
  // Só substituir a cópia anterior depois de validar sintaxe e assinatura.
  try { mdArquivos.writeString(mdCache, mdCodigo); } catch (_) { /* Rede ainda funciona. */ }
} catch (_) {
  try {
    if (mdArquivos.fileExists(mdCache)) mdExecutar = new Function("API", "KEY", "PAINEL", mdArquivos.readString(mdCache));
  } catch (_) { /* Primeira execução offline ou cópia inválida. */ }
}
if (mdExecutar) await mdExecutar(API, KEY, PAINEL);
else {
  const mdWidget = new ListWidget();
  mdWidget.backgroundColor = new Color("#f5f2ea"); mdWidget.setPadding(16, 16, 16, 16);
  mdWidget.url = PAINEL; mdWidget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  const mdTexto = mdWidget.addText("Sem dados do assistente");
  mdTexto.font = Font.semiboldSystemFont(13); mdTexto.textColor = new Color("#64675b"); mdTexto.lineLimit = 2;
  if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(mdWidget);
  else await mdWidget.presentMedium();
  Script.complete();
}
