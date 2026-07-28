// nav.js — navegação: troca entre as abas principais e as sub-abas de RPA & Bots,
// mais o pequeno helper de badge da navegação usado por várias views.

import { _animarNumero } from './charts.js';

// Troca entre as abas principais do dashboard.
// Funciona alternando a classe 'active' no item de navegação e na seção correspondente.
export function definirNav(id){
  ['upload','gov','proj','mel','rpa','ana'].forEach(nomeAba => {
    const itemDeNavegacao = document.getElementById('nav-'+nomeAba);
    const paginaDaAba     = document.getElementById('page-'+nomeAba);
    if(itemDeNavegacao) itemDeNavegacao.classList.toggle('active', nomeAba === id);
    if(paginaDaAba)     paginaDaAba.classList.toggle('active', nomeAba === id);
  });
  // Aba Pipefy Melhorias não usa o filtro global de data (ela tem sua própria
  // lógica de período com backlog sempre incluído — ver comentário no topo de views/mel.js).
  // Esconde o controle nessa aba e mostra normalmente nas demais.
  const filtroDataElemento = document.getElementById('date-filter');
  if(filtroDataElemento && filtroDataElemento.dataset.revelado === 'true'){
    filtroDataElemento.style.display = id === 'mel' ? 'none' : 'flex';
  }
  // Anima os KPIs da aba que acabou de ficar visível
  const paginaAtiva = document.getElementById('page-'+id);
  if(paginaAtiva) paginaAtiva.querySelectorAll('.knum').forEach(elementoKpi => {
    delete elementoKpi.dataset.an;
    _animarNumero(elementoKpi);
  });
}

// Troca entre as sub-abas de RPA & Bots
// (Visão geral, Top bots, Tipos de problema, Tempo de resolução, Chamados, Inventário de bots)
export function definirSubAbaRPA(id){
  document.querySelectorAll('#page-rpa .pip-sub-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#page-rpa .pip-nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('rpage-'+id);
  const nv = document.getElementById('rnav-'+id);
  if(pg) pg.classList.add('active');
  if(nv) nv.classList.add('active');
}

// Atualiza o badge numérico de uma aba no menu de navegação
export function definirBadge(id, txt, cls){
  const element = document.getElementById(id);
  if(element){ element.textContent=txt; element.className='nb'+(cls?' '+cls:''); }
}
