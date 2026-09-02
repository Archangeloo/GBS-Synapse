// views/mel.js — ABA: MELHORIAS PIPEFY
// FILTRO DE DATA: usa DataConclusaoRealDesenvolvimento.
// A maioria das melhorias em backlog/planejamento NÃO tem essa data.
// Ao filtrar por período, elas ficam de fora — comportamento correto e documentado.
// Pra ver todas as melhorias, use o filtro de Status dentro da aba.

import { App } from '../state.js';
import { STATUS_PT, STATUS_COLOR } from '../constants.js';
import { contarPorStatus, calcularPercentual, contagemOrdenada, ehIntegranteEquipePipefy, iconeKpi } from '../utils/helpers.js';
import { filtrarPorPeriodo } from '../utils/date.js';
import { graficoRosca, barrasHorizontais, renderizarGraficosPendentes } from '../charts.js';
import { barraAnalise } from '../analysis.js';
import { definirBadge } from '../nav.js';
import { renderizarSecaoAtividadesMelhorias } from './mel-activities.js';


/*
 * visaoGeralPorArea(M) — tabela "Overview por categoria" da aba Pipefy Melhorias.
 *
 * Linhas  = áreas de negócio (P2P, O2C, TAX…), na ordem padrão + extras no final.
 * Colunas = Melhorias (total) + detalhamento por status.
 *
 * "Dev + Planej." e "Validação" são as duas fatias de codigoStatus='doing', diferenciadas pelo statusRaw:
 *   Validação    → statusRaw contém "validação" ou "aguardando"
 *   Dev + Planej → codigoStatus='doing' e não é validação
 */
function visaoGeralPorArea(melhorias) {
  const ehValidacao = melhoria => {
    const textoStatus = (melhoria.statusRaw || '').toLowerCase();
    return textoStatus.includes('validação') || textoStatus.includes('validacao') || textoStatus.includes('aguardando');
  };

  const COLUNAS = [
    { label: 'Melhorias',     fn: null,                                                cls: '' },
    { label: 'Backlog',       fn: m => m.codigoStatus === 'todo',                      cls: '' },
    { label: 'Dev + Planej.', fn: m => m.codigoStatus === 'doing' && !ehValidacao(m),  cls: '' },
    { label: 'Validação',     fn: m => ehValidacao(m),                                cls: '' },
    { label: 'Pipefy',        fn: m => m.codigoStatus === 'vendor',                    cls: '' },
    { label: 'Bloqueado',     fn: m => m.codigoStatus === 'blocked',                   cls: '' },
    { label: 'Concluídos',    fn: m => m.codigoStatus === 'done',                      cls: 'ov-done' },
    { label: 'Cancelados',    fn: m => m.codigoStatus === 'cancel',                    cls: 'ov-cancel' },
  ];

  const ORDEM  = ['COE','P2P','O2C','R2R','TAX','H2R'];
  const CORES = { COE:'#0195D6', P2P:'#E83430', O2C:'#4DB1B3', R2R:'#E66407', TAX:'#0F5299', H2R:'#8B6FD4' };

  const todasFrentes = [...new Set(melhorias.map(m => m.frente).filter(Boolean))];
  const frentes = [
    ...ORDEM.filter(f => todasFrentes.includes(f)),
    ...todasFrentes.filter(f => !ORDEM.includes(f)).sort(),
  ];
  if (!frentes.length) return '';

  const celula = value => value
    ? `<td>${value}</td>`
    : `<td class="ov-zero">—</td>`;

  const linhas = frentes.map(frente => {
    const itens = melhorias.filter(m => m.frente === frente);
    const cor   = CORES[frente] || 'var(--ink3)';
    const cols  = COLUNAS.map((c, i) => celula(i === 0 ? itens.length : itens.filter(c.fn).length)).join('');
    return `<tr>
      <td><span class="ov-badge" style="background:${cor}">${frente}</span></td>
      ${cols}
    </tr>`;
  }).join('');

  const totais = COLUNAS.map((c, i) =>
    `<td>${i === 0 ? melhorias.length : melhorias.filter(c.fn).length}</td>`
  ).join('');

  const cabecalhos = COLUNAS.map(c =>
    `<th class="${c.cls}">${c.label}</th>`
  ).join('');

  return `<div class="card">
    <div class="card-title">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
      </svg>
      Overview por categoria
    </div>
    <div style="overflow-x:auto">
      <table class="ov-table">
        <thead><tr><th></th>${cabecalhos}</tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr>
          <td style="text-align:left">Total</td>
          ${totais}
        </tr></tfoot>
      </table>
    </div>
  </div>`;
}

/*
 * construirMelhorias() — aba Pipefy Melhorias.
 *
 * Lê:      App.dadosGovernanca.melhorias
 * Escreve: #mel-content
 * Chamada por: gerarDashboard() e renderizarTudo()
 *
 * ATENÇÃO — lógica especial de filtro de data:
 *   Usa dataInicio + dataFim (intervalo de desenvolvimento), não uma data única.
 *   Melhorias de backlog sem data são SEMPRE incluídas, mesmo com um
 *   filtro ativo (representam trabalho pendente, não histórico).
 *
 * Produz:
 *  - KPIs: total, concluídas, backlog, bloqueadas, fluxos distintos
 *  - Donut de status, barras por área, complexidade e responsável
 */
export function construirMelhorias(){
  const {kept: melhoriasFiltradas} = filtrarPorPeriodo(App.dadosGovernanca.melhorias);
  // Backlog sem data = trabalho pendente, não histórico. Sempre incluído.
  const backlogSemData = App.periodoFiltro.modo !== 'all'
    ? App.dadosGovernanca.melhorias.filter(m => !m.dataInicio && !m.dataFim && m.codigoStatus === 'todo')
    : [];
  const melhorias = [...melhoriasFiltradas, ...backlogSemData];
  document.getElementById('mel-empty').style.display  = App.dadosGovernanca.melhorias.length ? 'none' : 'block';
  document.getElementById('mel-content').style.display = App.dadosGovernanca.melhorias.length ? 'block' : 'none';
  if(!App.dadosGovernanca.melhorias.length) return;
  const contagem = contarPorStatus(melhorias);
  const done    = contagem.done;
  const backlog = contagem.todo;
  const blocked = contagem.blocked;

  let notaData = '';
  if(App.periodoFiltro.modo !== 'all'){
    notaData = `<div class="note" style="background:var(--neu-bg);color:var(--ink3)"><i class="ti ti-calendar-stats"></i><div>
      Período aplicado: <b>${melhorias.length} melhorias</b> no recorte${backlogSemData.length > 0 ? ` (inclui <b>${backlogSemData.length} backlog</b> sem data)` : ''}.
      <br><span style="font-size:10px;opacity:.6;font-style:italic">Referência de data: início e conclusão do desenvolvimento — inclui melhorias ativas no período, mesmo que iniciadas antes dele</span>
      </div></div>`;
  }

  // "Fluxos (processos)" = número de NomeFluxo distintos no recorte atual
  const fluxosUnicos = new Set(App.dadosGovernanca.melhorias.map(m => m.fluxo).filter(Boolean)).size;

  // Qualidade de dados: concluída sem dataFim = erro de preenchimento na planilha.
  // Itens não concluídos sem dataFim estão corretos (ainda em andamento/backlog).
  const concluidasSemData = App.dadosGovernanca.melhorias.filter(m => m.codigoStatus==='done' && !m.dataFim).length;

  let html = notaData + `<div class="sh">Pipefy — Melhorias & Ajustes</div>
  ${barraAnalise('mel')}
  <div class="krow k5">
    <div class="kpi">${iconeKpi('message')}<div class="knum">${App.dadosGovernanca.melhorias.length}</div><div class="klbl">Total melhorias</div>${App.periodoFiltro.modo !== 'all' ? `<div class="ksub">${melhorias.length} no recorte</div>` : ''}</div>
    <div class="kpi gl">${iconeKpi('check')}<div class="knum">${done}</div><div class="klbl">Concluídas</div><div class="ksub">${calcularPercentual(done,App.dadosGovernanca.melhorias.length)}% do total</div></div>
    <div class="kpi">${iconeKpi('stack')}<div class="knum">${backlog}</div><div class="klbl">Backlog</div></div>
    <div class="kpi wl">${iconeKpi('lock')}<div class="knum">${blocked}</div><div class="klbl">Bloqueadas</div></div>
    <div class="kpi il">${iconeKpi('branch')}<div class="knum">${fluxosUnicos}</div><div class="klbl">Fluxos (processos)</div><div class="ksub">distintos no recorte</div></div>
  </div>
  ${concluidasSemData > 0 ? `<div class="note" style="background:var(--neu-bg);color:var(--ink3)"><i class="ti ti-alert-triangle" style="color:var(--warn)"></i><div>
    <b>${concluidasSemData} melhorias marcadas como concluídas não têm data de conclusão preenchida.</b>
    Isso é um erro de preenchimento na planilha — preencher o campo <i>DataConclusaoRealDesenvolvimento</i> permite análise temporal correta dessas entregas.
  </div></div>` : ''}`;

  html += `<div class="two">
    <div class="card"><div class="card-title"><i class="ti ti-chart-pie"></i> Status</div>
      ${graficoRosca(['done','doing','todo','vendor','blocked','cancel'].map(k=>({label:STATUS_PT[k],value:melhorias.filter(m=>m.codigoStatus===k).length,color:STATUS_COLOR[k]})).filter(d=>d.value), {total:App.dadosGovernanca.melhorias.length})}</div>
    <div class="card"><div class="card-title"><i class="ti ti-building"></i> Por frente</div>
      ${barrasHorizontais(contagemOrdenada(melhorias, m=>m.frente),{max:8,lw:60,tot:melhorias.length})}</div>
  </div>`;
  html += `<div class="two">
    <div class="card"><div class="card-title"><i class="ti ti-stack-2"></i> Por complexidade</div>
      ${barrasHorizontais(contagemOrdenada(melhorias.filter(m=>m.complexidade), m=>m.complexidade),{max:6,lw:90})}</div>
    <div class="card"><div class="card-title"><i class="ti ti-user-code"></i> Por responsável</div>
      ${(() => {
        const dados = contagemOrdenada(melhorias.filter(m=>m.responsavel && ehIntegranteEquipePipefy(m.responsavel)), m=>m.responsavel);
        return barrasHorizontais(dados,{max:8,lw:130});
      })()}</div>
  </div>`;
  html += visaoGeralPorArea(melhorias);
  html += '<div id="mel-atividades"></div>';
  document.getElementById('mel-content').innerHTML = html;
  renderizarGraficosPendentes();
  definirBadge('nb-mel', melhorias.length, '');
  renderizarSecaoAtividadesMelhorias();
}
