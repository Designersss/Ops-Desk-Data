/* Показатели подразделений. Значения рассчитаны по встроенным исходным записям для согласования интерфейса. */
function productionAnalytics(type){
  const items=records[type];
  const sum=(arr,key)=>arr.reduce((total,item)=>total+(Number(item[key])||0),0);
  const fmt=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value);
  let metrics=[],legend='',chartTitle='',chartSubtitle='';
  if(type==='preparation'){
    const confirmed=items.filter(validPrep),plan=sum(confirmed,'plan'),fact=sum(confirmed,'fact');
    metrics=[
      ['Выполнение подтверждённых',plan?fmt(fact/plan*100)+'%':'—','Факт относительно плана'],
      ['Подтверждённый факт',fmt(fact)+' ед.','По проверенным записям'],
      ['Записи участка',String(items.length),'Всего в журнале'],
      ['Требуют проверки',String(items.length-confirmed.length),'Не входят в подтверждённый факт']
    ];
    legend='<span><i class="dept-legend-plan"></i>План</span><span><i class="dept-legend-fact"></i>Подтверждённый факт</span>';
    chartTitle='План и факт по партиям';
    chartSubtitle='Неподтверждённые значения не отображаются как ноль';
  }else if(type==='welding'){
    const confirmed=items.filter(r=>{const matching=preparationMatches(r.batch);return matching.length===1&&validPrep(matching[0].item);});
    metrics=[
      ['Общая потребность',fmt(sum(items,'need'))+' ед.','По всем заявкам'],
      ['Заявки участка',String(items.length),'Всего в журнале'],
      ['Проверенная обеспеченность',String(confirmed.length)+' из '+items.length,'Связь с заготовкой подтверждена'],
      ['Требуют проверки',String(items.length-confirmed.length),'Обеспеченность не определена']
    ];
    legend='<span><i class="dept-legend-need"></i>Потребность</span>';
    chartTitle='Потребность по партиям';
    chartSubtitle='Объём заявок сварки в единицах';
  }else{
    const plan=sum(items,'plan'),fact=sum(items,'fact');
    metrics=[
      ['Выполнение плана',plan?fmt(fact/plan*100)+'%':'—','Факт относительно плана'],
      ['Выполнено документов',fmt(fact),'За весь период'],
      ['Запланировано',fmt(plan),'Документов по журналу'],
      ['Записи участка',String(items.length),'Всего в журнале']
    ];
    legend='<span><i class="dept-legend-plan"></i>План</span><span><i class="dept-legend-fact"></i>Факт</span>';
    chartTitle='План и факт по записям';
    chartSubtitle='Документация рассчитывается независимо';
  }
  const plotted=items.map(r=>({
    item:r,
    planned:type==='welding'?r.need:r.plan,
    actual:type==='welding'?null:type==='preparation'?(validPrep(r)?r.fact:null):r.fact
  }));
  const max=Math.max(1,...plotted.flatMap(row=>[row.planned,row.actual??0]));
  const bars=plotted.map(({item,planned,actual})=>{
    const firstHeight=Math.max(1,Math.round(planned/max*100));
    const secondHeight=actual===null?null:Math.max(actual===0?0:2,Math.round(actual/max*100));
    const actualHtml=type==='welding'?'':actual===null
      ?'<span class="dept-bar-missing" title="Значение требует проверки">—</span>'
      :'<span class="dept-bar dept-bar-fact" style="height:'+secondHeight+'%" title="Факт: '+actual+'"></span>';
    return '<div class="dept-chart-item"><div class="dept-chart-bars"><span class="dept-bar '+(type==='welding'?'dept-bar-need':'dept-bar-plan')+'" style="height:'+firstHeight+'%" title="'+(type==='welding'?'Потребность: ':'План: ')+planned+'"></span>'+actualHtml+'</div><span class="dept-chart-label">'+(item.batch||item.id)+'</span></div>';
  }).join('');
  return '<section class="department-analytics" aria-label="Показатели участка"><div class="department-section-label">ПОКАЗАТЕЛИ УЧАСТКА</div><div class="department-metrics">'
    +metrics.map(([label,value,desc])=>'<article class="panel dept-metric"><span>'+label+'</span><strong>'+value+'</strong><small>'+desc+'</small></article>').join('')
    +'</div><article class="panel dept-chart-panel"><div class="dept-chart-header"><div><h2>'+chartTitle+'</h2><p>'+chartSubtitle+'</p></div><div class="dept-legend">'+legend+'</div></div><div class="dept-chart-scroll"><div class="dept-chart" style="--dept-count:'+plotted.length+'">'+bars+'</div></div></article></section>';
}
