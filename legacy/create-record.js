/* Единый экран создания записи для трёх производственных участков. */
const newRecordFields = {
  preparation: {
    main: [
      {name:'id',label:'Номер записи',placeholder:'Например, P-009',required:true,help:'Идентификатор записи в журнале.'},
      {name:'date',label:'Дата записи',type:'date',required:true},
      {name:'batch',label:'Номер партии',placeholder:'Например, LOT-09',required:true,help:'По номеру партии заготовка сопоставляется со сваркой.'},
      {name:'employee',label:'Сотрудник',placeholder:'Фамилия Имя',required:true}
    ],
    values: [
      {name:'plan',label:'План, ед.',type:'number',placeholder:'0',min:1,required:true,help:'Плановое количество заготовки.'},
      {name:'fact',label:'Факт, ед.',type:'number',placeholder:'0',min:0,help:'Можно оставить пустым, пока факт не известен.'}
    ],
    infoTitle:'Связь со сваркой',
    info:'Номер партии используется для сопоставления заготовки с потребностью сварки. Данные с ошибками не должны формировать подтверждённую обеспеченность.',
    note:'Укажите план и фактический объём. Если факт ещё не известен, оставьте поле незаполненным.'
  },
  welding: {
    main: [
      {name:'id',label:'Номер записи',placeholder:'Например, W-009',required:true,help:'Идентификатор заявки в журнале.'},
      {name:'date',label:'Дата заявки',type:'date',required:true},
      {name:'batch',label:'Номер партии',placeholder:'Например, LOT-09',required:true,help:'Партия для сопоставления с данными заготовки.'}
    ],
    values: [
      {name:'need',label:'Потребность, ед.',type:'number',placeholder:'0',min:0,required:true,help:'Необходимый объём для сварки.'}
    ],
    infoTitle:'Проверка обеспеченности',
    info:'Обеспеченность рассчитывается по подтверждённой заготовке этой партии. При ошибке или отсутствии связанного факта итог должен отмечаться как неподтверждённый.',
    note:'Введите потребность и номер партии. Данные о заготовке в этой форме не редактируются.'
  },
  documents: {
    main: [
      {name:'id',label:'Номер записи',placeholder:'Например, D-007',required:true,help:'Идентификатор документационной записи.'},
      {name:'date',label:'Дата записи',type:'date',required:true},
      {name:'employee',label:'Сотрудник',placeholder:'Фамилия Имя',required:true}
    ],
    values: [
      {name:'plan',label:'План, док.',type:'number',placeholder:'0',min:1,required:true,help:'Сколько документов запланировано.'},
      {name:'fact',label:'Факт, док.',type:'number',placeholder:'0',min:0,help:'Можно оставить пустым, если результат ещё не внесён.'}
    ],
    infoTitle:'Независимый учёт',
    info:'Показатели документации рассчитываются отдельно и не должны изменяться из-за ошибок заготовки или сварки.',
    note:'План и факт документации учитываются только в показателях этого участка.'
  }
};
function newRecordField(field){
  const inputType=field.type||'text';
  const fieldId='new-record-'+field.name;
  const helpId=field.help?fieldId+'-help':null;
  const attr=[
    'id="'+fieldId+'"',
    'name="'+field.name+'"',
    'type="'+inputType+'"',
    'class="create-field-control"',
    field.placeholder?'placeholder="'+field.placeholder+'"':'',
    field.required?'required':'',
    field.min!==undefined?'min="'+field.min+'"':'',
    inputType==='number'?'step="1"':'',
    'autocomplete="off"',
    helpId?'aria-describedby="'+helpId+'"':''
  ].filter(Boolean).join(' ');
  return '<div class="create-field"><label for="'+fieldId+'">'+field.label+(field.required?' <span class="create-required" aria-label="обязательное поле">*</span>':'')+'</label><input '+attr+'>'+(
    helpId?'<div class="create-field-help" id="'+helpId+'">'+field.help+'</div>':'')+'</div>';
}
function createRecordPage(type){
  const cfg=newRecordFields[type];
  if(!cfg)return '';
  const dept=pages[type].short;
  return '<div class="create-record-page">'
   +'<button type="button" class="back-link create-record-back" data-go="'+type+'">'+elIcon('arrow-left')+' К журналу «'+dept+'»</button>'
   +'<div class="create-record-layout">'
   +'<form id="newRecordForm" class="create-record-main" data-create-type="'+type+'">'
   +'<section class="panel create-card"><div class="create-card-head"><span class="create-card-step">01</span><div><h2>Основная информация</h2><p>Укажите данные, по которым запись будет отображаться в журнале.</p></div></div>'
   +'<div class="create-field-grid">'+cfg.main.map(newRecordField).join('')+'</div></section>'
   +'<section class="panel create-card"><div class="create-card-head"><span class="create-card-step">02</span><div><h2>Показатели</h2><p>Значения производственного участка.</p></div></div>'
   +'<div class="create-field-grid">'+cfg.values.map(newRecordField).join('')+'</div>'
   +'<p class="create-inline-note">'+elIcon('info')+cfg.note+'</p></section>'
   +'<div class="create-form-actions"><button type="button" class="btn btn-outline" data-go="'+type+'">Отмена</button><button type="submit" class="btn btn-primary">'+elIcon('plus')+' Добавить запись</button></div>'
   +'</form>'
   +'<aside class="create-record-aside" aria-label="Подсказки по заполнению">'
   +'<section class="panel create-aside-card"><div class="create-aside-icon">'+elIcon('files')+'</div><h3>'+dept+'</h3><p>Новая запись появится в журнале этого участка после сохранения.</p><div class="create-aside-divider"></div>'
   +'<div class="create-aside-caption">ЗАПОЛНЕНИЕ</div><p>Поля со звёздочкой обязательны. Все показатели должны относиться к одной записи.</p></section>'
   +'<section class="create-context-card"><div class="create-context-icon">'+elIcon('info')+'</div><div><h3>'+cfg.infoTitle+'</h3><p>'+cfg.info+'</p></div></section>'
   +'</aside></div></div>';
}
