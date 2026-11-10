(() => {
  'use strict';

  // ---------- DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const stage = $('#stage');

  // Рамка демо — demo-frame из ui-kit: шапка, сцена 1600×900 и вспомогательная панель справа масштабируются как одно целое.
  let scale = 1;
  let scenSyncing = false; // панель догоняет открытую страницу, сцену не трогаем
  // disabled — сценарий пока не сделан
  const frame = DemoFrame.mount({
    stage,
    head: { title: 'Динамические страницы' },
    devices: [
      { id: 'laptop', icon: 'laptop', label: 'Ноутбук', disabled: true },
      { id: 'monitor', icon: 'monitor', label: 'Монитор', size: '1600х900', name: 'монитор' },
    ],
    device: 'monitor',
    scenarios: [
      // { id: 'catalog-add', title: 'Добавление каталога' }, // пока скрыт; вернуть — раскомментировать и вернуть data-scenario="catalog-add" в index.html
      { id: 'typical', title: 'Типовое заполнение' },
    ],
    team: [
      { label: 'Design', name: 'Смирнова Мария', links: [
        { title: 'Концепт', href: 'https://project.sbis.ru/shared/disk/63e4cc46-a77f-459c-9da3-3e4f1c731f59' },
      ] },
      { label: 'Develop', name: 'Волоцкой Вадим', links: [
        { title: 'Разработка макета', href: 'https://project.sbis.ru/opendoc.html?guid=019fa875-c83e-78a9-8b5e-efe37d762dc1&client=3' },
      ] },
    ],
    value: { scenario: stage.dataset.scenario },
    onScale: (s) => { scale = s; },
    onChange: ({ scenario, variant }) => {
      stage.dataset.scenario = scenario;
      stage.dataset.variant = variant ?? '';
      if (scenSyncing) return;
      rsCloseParams();
      scenApply(scenario, variant);
    },
  });

  // Панель сценариев: группа demo-frame в своём оформлении, статус показа добавляем поверх его разметки.
  for (const g of $('.df-card--scen', frame.panel).querySelectorAll('.df-group')) g.classList.add('pop-sub');

  $('.df-team', frame.panel).before(el('div', 'pop-status', '<span class="ico24">&#xE651;</span>Не показывали'));

  function stageRect(node) {
    const s = stage.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    return { left: (r.left - s.left) / scale, top: (r.top - s.top) / scale, width: r.width / scale, height: r.height / scale };
  }

  // Окна настроек (.pe) перетаскиваются за шапку и не выходят за края сцены. Следующее открытие ставит окно на обычное место.
  // Слушаем само окно: так перетаскивание работает, даже если разметку шапки пересоздали.
  function peMoveTo(root, left, top) {
    root.style.left = Math.round(Math.max(0, Math.min(left, stage.offsetWidth - root.offsetWidth))) + 'px';
    root.style.top = Math.round(Math.max(0, Math.min(top, stage.offsetHeight - root.offsetHeight))) + 'px';
  }
  function peDraggable(root, onMove) {
    root.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.target.closest('.pe__head') || e.target.closest('button, input')) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const left = root.offsetLeft;
      const top = root.offsetTop;
      const move = (ev) => {
        onMove?.();
        peMoveTo(root, left + (ev.clientX - startX) / scale, top + (ev.clientY - startY) / scale);
      };
      const up = () => {
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerup', up);
        root.removeEventListener('pointercancel', up);
      };
      root.setPointerCapture(e.pointerId);
      root.addEventListener('pointermove', move);
      root.addEventListener('pointerup', up);
      root.addEventListener('pointercancel', up);
    });
  }

  // Одновременно открыто одно окно или меню: новое закрывает прежнее, несохранённые правки в нём отменяются, как крестиком.
  // Без родителя не работают и остаются с ним только меню «Способа отображения», меню и палитры PropertyEditor.
  function popupsClose() {
    salesClose();
    catSetClose();
    rsCloseParams();
    lsCloseMenu();
    lsNewClose();
    secClose();
    bgClose();
  }

  // ---------- Правый сайдбар (Figma WHZ4ZSm4wRMrxQPWqEk5Wk 148:15451) ----------
  // Вписан в страницу, по умолчанию открыт «Магазин». Клик по иконке переключает панель, повторный — сворачивает до тулбара.
  // «Настройки» открывают окно поверх контента: вписанная панель скрыта, но её место остаётся за ней, поэтому контент не прыгает. Закрытие окна возвращает панель.
  // «Структура», «Стиль», «Шрифт» пока только с ховером: их панелей в макете нет.
  const rsParams = $('#rsParams');
  let rsPanel = 'shop';    // открытая панель или null
  let rsParamsOpen = false;

  function rsRender() {
    stage.classList.toggle('is-rs-closed', !rsPanel);
    for (const name of ['shop', 'data']) $('#rs-' + name).hidden = name !== rsPanel || rsParamsOpen;
    rsParams.hidden = !rsParamsOpen;
    if (rsParamsOpen) productPageRender(); // при старте окно закрыто: до объявления productPage* не доходим
    else { // меню страницы товара закрывается вместе с окном; через DOM — rsRender зовётся и до объявления productPage*
      $('#productPageMenu').hidden = true;
      $('#productPagePick').setAttribute('aria-expanded', 'false');
    }
    for (const b of document.querySelectorAll('.rp-btn[data-rp]')) {
      const on = rsParamsOpen ? b.dataset.rp === 'settings' : b.dataset.rp === rsPanel;
      b.classList.toggle('is-active', on);
    }
  }

  function rsCloseParams() {
    if (!rsParamsOpen) return;
    salesPickerCancel();
    rsParamsOpen = false;
    rsRender();
  }

  for (const b of document.querySelectorAll('.rp-btn[data-rp]')) {
    b.addEventListener('click', () => {
      const name = b.dataset.rp;
      if (name === 'settings') {
        const open = !rsParamsOpen;
        popupsClose();
        rsParamsOpen = open;
      }
      else if (rsParamsOpen) { popupsClose(); rsPanel = name; }
      else { salesClose(); rsPanel = rsPanel === name ? null : name; }
      rsRender();
    });
  }
  $('#rsParamsClose').addEventListener('click', rsCloseParams);
  stage.addEventListener('mousedown', (e) => {
    if (rsParamsOpen && !e.target.closest('#rsParams, #salesPicker, #salesPopup, #confirm, .rp-btn')) rsCloseParams();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && salesPicker.hidden) rsCloseParams(); });

  // Точки и прайсы — демоданные из сценария Figma. Изменения в окне хранятся в черновике до ✓.
  const ROOT_SALES = [
    { id: 'mili', name: 'Ресторан “Мили”', price: 'Меню A la carte' },
    { id: 'uglich', name: 'Ресторан “Мили” на Угличской', price: 'Меню Престо' },
    { id: 'teremok', name: 'Теремок', price: 'Меню A la carte' },
    { id: 'dvina', name: 'Хостел ДВИНА', price: 'Меню Престо' },
  ];
  const SALES_GROUPS = [
    { id: 'tensor', name: 'Тензор', names: ['Кафе «Московский проспект»', 'Столовая «На Угличской»'] },
    { id: 'kvesta', name: 'Квеста Бухобслуживание', names: ['Кафе «На Свободе»', 'Столовая «Центральная»'] },
    { id: 'hotel', name: 'SabyHotel', names: ['Ресторан «Волжская ривьера»', 'Лобби-бар «Панорама»'] },
    { id: 'tbank', name: 'Тинькофф', names: ['Кафе «Перерыв»', 'Кофейня «Пятый этаж»'] },
    { id: 'adygea', name: '01- Республика Адыгея', names: ['Ресторан «Майкоп»', 'Кафе «Адыгея»'] },
    { id: 'plyushkin', name: 'ИП Плюшкин', names: ['Пекарня «У Плюшкина»', 'Кофейня «Булка и кофе»'] },
  ].map((group) => ({ ...group, points: group.names.map((name, i) => ({ id: group.id + '-' + i, name, price: i ? 'Меню Престо' : 'Меню A la carte' })) }));
  const SALES = [...ROOT_SALES, ...SALES_GROUPS.flatMap((group) => group.points)];
  // Данные основной точки для «Текущей точки» в панели «Данные»; у остальных точек — только название
  const SALES_INFO = {
    mili: { description: 'Авторская кухня и сезонное меню', phone: '+7 (4852) 12-13-14', address: 'г. Ярославль, ул. Свободы, 46', hours: 'Ежедневно 10:00–23:00', email: 'mili@mili-rest.ru' },
    uglich: { description: 'Семейный ресторан с детской комнатой', phone: '+7 (4852) 20-30-40', address: 'г. Ярославль, ул. Угличская, 12', hours: 'Ежедневно 11:00–22:00', email: 'uglich@mili-rest.ru' },
  };
  const SALES_FIELDS = [
    ['name', 'Название', 'Строка'],
    ['description', 'Описание', 'Текст'],
    ['phone', 'Телефон', 'Телефон'],
    ['address', 'Адрес', 'Адрес'],
    ['hours', 'Режим работы', 'Строка'],
    ['email', 'Email', 'Email'],
  ];
  const salesExpanded = new Set();
  const PRICES = ['Меню A la carte', 'Меню Престо', 'Прайс для кофейни', 'Демо прайс', 'Прайс в ресторане на Московском'];
  const PRICE_CURRENT = 'Из текущей точки продаж';
  const PRICE_GROUPS = ['Мили', 'Столовая в Костроме', 'Столовые в Ярославле', 'Мили'];
  let priceGroup = null;
  const salesPopup = $('#salesPopup');
  const salesPicker = $('#salesPicker');
  let catalogAdded = false;
  let salesSaved = [];
  let salesDraft = null;
  let salesSelection = new Set();
  let salesPickerMode = null;
  let salesOnlySelected = false;
  // Компоненты: виджет из магазина подключает свой компонент, а с ним приходят компоненты, от которых он зависит (deps) — они его часть. Компонент приносит страницы и настройки
  // (в «Параметры сайта», группа «Компоненты»). Связи — из документа «Компоненты интернет магазина». Настройки пока есть только у «Ресторана» — точки продаж.
  // widget — виджет компонента в магазине, widgetPage — страница, которую виджет открывает. Страницы создаются под виджет: у каждой страницы компонента свой виджет
  // (widgetPage — карточка блюда, остальные — по widgets). widgetHome — страница для самого виджета: приходит, только если компонент подключили в «Параметрах сайта», а его виджета на сайте нет.
  // Виджет, поставленный из магазина, стоит там, куда его поставили (в сценариях компонентов — на главной), страницы для него не создаётся.
  // Порядок — как в таблице документа; он же порядок чипсов в «Параметрах сайта»
  // Пока один компонент — «Ресторан»: без зависимостей, приносит страницу товара «Карточка блюда», без доп. настроек «Доставка»/«Самовывоз»
  const COMP = {
    restaurant: { name: 'Ресторан', desc: 'Меню и карточки блюд на сайте, цены и наличие из точек продаж', deps: [], pages: ['Карточка блюда'], widget: 'Каталог', widgetPage: 'Карточка блюда' },
  };
  const compOn = new Set();    // подключавшиеся, в порядке подключения: их страницы и настройки на сайте
  const compRoots = new Set(); // подключённые виджетом, а не как зависимость
  let catalogHome = false;     // каталог стоит на главной (сценарии компонентов), а не на странице «Меню» прочих сценариев
  let catalogMenu = false;     // каталог стоит на странице «Меню», которую принёс «Ресторан» (подключён в «Параметрах сайта» без виджета)
  const compConfigured = () => salesSaved.length > 0;
  // Дополнительные настройки подключённого компонента (options) — серые чипсы, как в блоке «Сайт». Пока без действия
  function compOptionsFill(root, id) {
    root.replaceChildren(...(compOn.has(id) ? COMP[id].options ?? [] : []).map((name) => {
      const chip = el('button', 'chips chips--size-m', '<span class="chips__caption"></span>');
      chip.type = 'button';
      chip.firstChild.textContent = name;
      return chip;
    }));
  }
  // Чипсы «Параметров сайта»: неподключённые компоненты, иконка компонента + название. Подключённый уходит из чипсов
  function compChipsRender() {
    const chips = Object.entries(COMP).filter(([id]) => !compOn.has(id)).map(([id, c]) => {
      const chip = el('button', 'chips chips--optional'); // опциональное свойство ui-kit (PropertyGrid 37372:32955)
      chip.type = 'button';
      chip.dataset.compAdd = id;
      chip.title = c.desc;
      chip.setAttribute('aria-label', 'Подключить компонент: ' + c.name);
      chip.innerHTML = `<span class="chips__icon"><img src="assets/img/comp/${id}.svg" alt=""></span><span class="chips__caption"></span>`;
      chip.lastChild.textContent = c.name;
      return chip;
    });
    // Подключённые — группами в порядке чипсов (порядок COMP). У «Ресторана» своя разметка: блок #salesSettings встаёт на своё место, скрывает его salesRender
    const groups = Object.keys(COMP).filter((id) => id === 'restaurant' || compOn.has(id)).map((id) => {
      if (id === 'restaurant') return $('#salesSettings');
      const group = el('section', 'sales-settings comp-group');
      group.setAttribute('aria-label', COMP[id].name);
      group.innerHTML = `<div class="sales-settings__head"><div><img class="sales-settings__icon" src="assets/img/comp/${id}.svg" width="24" height="24" alt=""><span></span></div></div>`
        + `<button class="sales-settings__remove" type="button" data-comp-toggle="${id}"><span class="ico">&#xE66C;</span></button>`;
      $('.sales-settings__head span', group).textContent = COMP[id].name;
      group.lastChild.setAttribute('aria-label', `Отключить компонент «${COMP[id].name}»`);
      const options = el('div', 'rs-site__chips comp-options');
      compOptionsFill(options, id);
      group.insertBefore(options, group.lastChild);
      return group;
    });
    compOptionsFill($('#salesSettingsOptions'), 'restaurant');
    // В «Параметрах сайта» пока только группа «Ресторан»: остальные группы и «Добавить компонент» не показываем
    $('#compGroups').replaceChildren(...groups.filter((g) => g.id === 'salesSettings'));
    $('#compChips').replaceChildren(...chips);
    $('#compChipsBlock').hidden = true;
  }
  const salesCopy = (rows) => rows.map((row) => ({ ...row, prices: row.prices?.slice() }));
  const salesCurrent = () => salesDraft || salesSaved;

  // pricePick — прайс кнопкой, открывает выбор прайсов (прежний вид «Параметров сайта», Figma 2547:71389)
  function salesRenderRows(root, rows, pricePick = false) {
    root.replaceChildren();
    root.hidden = pricePick && !rows.length; // в «Параметрах сайта» без точек — ни текста, ни пустой плашки
    if (root.hidden) return;
    if (!rows.length) {
      const empty = el('p', 'sales-empty');
      // «точки продаж» — кнопка-ссылка, работает как «+»
      empty.innerHTML = 'Добавьте ваши <button class="sales-empty__link" type="button" data-sales-add>точки продаж</button>, чтобы получать актуальную информацию о них';
      root.append(empty);
      return;
    }
    for (const [index, row] of rows.entries()) {
      // Строка не кликается: её можно только перетащить, первая — основная точка
      const item = el('div', 'sales-row');
      item.draggable = true;
      item.dataset.salesRow = row.id;
      const name = el('div', 'sales-row__name');
      const label = el('span');
      label.textContent = SALES.find((point) => point.id === row.id).name;
      name.append(label);
      if (!index) name.append(el('span', 'ico', '&#xEABA;'));
      const price = el(pricePick ? 'button' : 'span', 'sales-price');
      price.textContent = row.price;
      if (pricePick) {
        // текст — отдельным span с троеточием, чтобы кнопка не обрезала индикатор клика
        price.replaceChildren(el('span', 'sales-price__text'));
        price.firstChild.textContent = row.price;
        price.type = 'button';
        price.dataset.salesPrice = row.id;
        price.setAttribute('aria-label', 'Прайс: ' + label.textContent);
      }
      const actions = el('div', 'sales-row__actions');
      if (index) {
        const primary = el('button', 'has-tip', '<span class="ico">&#xEABA;</span>');
        primary.type = 'button';
        primary.dataset.salesPrimary = row.id;
        primary.dataset.tip = 'Сделать текущей точкой';
        primary.setAttribute('aria-label', 'Сделать текущей точкой: ' + label.textContent);
        actions.append(primary);
      }
      const remove = el('button', '', '<span class="ico">&#xE65C;</span>');
      remove.type = 'button';
      remove.dataset.salesDelete = row.id;
      remove.setAttribute('aria-label', 'Удалить точку: ' + label.textContent);
      actions.append(remove);
      item.append(name, price, actions);
      root.append(item);
    }
  }
  function salesRender() {
    compChipsRender();
    // Прежний вид «Параметров сайта»: точки продаж с прайсами — когда есть каталог или подключён «Ресторан»
    $('#salesSettings').hidden = false; // единственная группа «Параметров сайта» — видна всегда
    $('#salesSettingsRows').hidden = true; // точки продаж в «Параметрах сайта» не показываем; вернуть: salesRenderRows($('#salesSettingsRows'), salesSaved, true)
    $('#salesData').hidden = true; // «Текущая точка» в «Данных» пока скрыта; вернуть: !catalogAdded && !compOn.has('restaurant')
    $('#siteCatalog').classList.toggle('is-demo', (catalogHome || catalogMenu) && !salesSaved.length); // без точек продаж — демоданные
    salesRenderRows($('#salesPopupRows'), salesCurrent());
    $('#salesReset').disabled = !salesDraft?.length; // сброс убирает точки: без них сбрасывать нечего
    salesDataCurrentRender();
  }
  // «Текущая точка» в панели «Данные» — поля основной (первой) точки продаж: название поля, тип справа, значение строкой ниже. Figma 3042:49624
  function salesDataCurrentRender() {
    const row = salesSaved[0];
    const point = row && { name: SALES.find((p) => p.id === row.id).name, ...SALES_INFO[row.id] };
    $('#salesDataCurrent').replaceChildren(...SALES_FIELDS.map(([key, name, type]) => {
      const item = el('div', 'rs-sub');
      const head = el('div', 'rs-sub__head');
      const title = el('span', 'rs-sub__name');
      title.textContent = name;
      const kind = el('span', 'rs-sub__type');
      kind.textContent = type;
      head.append(title, kind);
      item.append(head);
      const value = point?.[key];
      if (value) {
        const text = el('div', 'rs-sub__value');
        text.textContent = value;
        text.title = value;
        item.append(text);
      }
      return item;
    }));
  }
  function salesPickerCancel() {
    if (salesPicker.hidden) return;
    salesPicker.hidden = true;
    salesPickerMode = null;
  }
  function salesClose() {
    salesPickerCancel();
    salesPopup.hidden = true;
    salesDraft = null;
  }
  // Из «Параметров сайта» окно компонента открывается поверх них, параметры остаются открыты
  function salesOpen(overParams = false) {
    overParams = overParams === true && rsParamsOpen;
    if (overParams) { salesPickerCancel(); lsCloseMenu(); lsNewClose(); secClose(); bgClose(); }
    else popupsClose();
    salesPopup.classList.toggle('sales-popup--over-params', overParams);
    salesDraft = salesCopy(salesSaved);
    salesRender();
    salesPopup.hidden = false;
  }
  function salesPickerOpen(pointId = null) {
    salesPickerMode = pointId || 'points';
    salesOnlySelected = false;
    const rows = salesCurrent();
    const priceRow = pointId && rows.find((row) => row.id === pointId);
    // Точек ещё нет — список открывается с уже отмеченными двумя ресторанами «Мили»
    const picked = rows.length ? rows.map((row) => row.id) : ROOT_SALES.slice(0, 2).map((point) => point.id);
    salesSelection = new Set(pointId ? (priceRow.prices || [priceRow.price]) : picked);
    priceGroup = null;
    salesPicker.classList.toggle('sales-picker--prices', !!pointId);
    const search = $('.sales-picker__search', salesPicker);
    const head = $('.sales-picker__head', salesPicker);
    if (pointId) head.prepend(search);
    else $('.sales-picker__main', salesPicker).insertBefore(search, $('#salesPickerList'));
    $('#salesPickerTitle').textContent = pointId ? 'Прайсы' : 'Точки продаж';
    $('#salesSearch').value = '';
    $('#salesSearch').setAttribute('aria-label', pointId ? 'Поиск прайсов' : 'Поиск точек продаж');
    salesPicker.hidden = false;
    salesPickerRender();
    $('#salesSearch').focus();
  }
  function salesPickerRender() {
    const root = $('#salesPickerList');
    root.replaceChildren();
    const query = $('#salesSearch').value.trim().toLocaleLowerCase('ru');
    const isPrice = salesPickerMode !== 'points';
    salesPickerHeader();
    const matches = (option) => option.name.toLocaleLowerCase('ru').includes(query) && (!salesOnlySelected || salesSelection.has(option.id));
    function optionRow(option) {
      const label = el('label', 'sales-option');
      const input = el('input');
      input.type = 'checkbox';
      input.name = 'sales-selection';
      input.value = option.id;
      input.checked = salesSelection.has(option.id);
      input.addEventListener('change', () => {
        if (input.checked) salesSelection.add(option.id);
        else salesSelection.delete(option.id);
        salesPickerHeader();
        if (salesOnlySelected) salesPickerRender();
      });
      label.append(input, document.createTextNode(option.name));
      return label;
    }
    let count = 0;
    if (isPrice) {
      const current = { id: PRICE_CURRENT, name: PRICE_CURRENT };
      if (matches(current)) { root.append(optionRow(current)); count++; }
      if (!query && !salesOnlySelected) {
        root.append(el('div', 'price-picker__divider'));
        if (priceGroup !== null) {
          const back = el('button', 'price-picker__group', '<span class="ico">&#xE674;</span>');
          back.type = 'button';
          back.append(document.createTextNode('Все прайсы'));
          back.addEventListener('click', () => { priceGroup = null; salesPickerRender(); });
          root.append(back);
        } else {
          PRICE_GROUPS.forEach((name, index) => {
            const group = el('button', 'price-picker__group');
            group.type = 'button';
            group.append(document.createTextNode(name), el('span', 'ico', '&#xEB89;'));
            group.setAttribute('aria-label', 'Открыть группу ' + name);
            group.addEventListener('click', () => { priceGroup = index; salesPickerRender(); });
            root.append(group);
          });
        }
      }
      const names = priceGroup === null ? PRICES : priceGroup === 0 || priceGroup === 3 ? PRICES.slice(0, 2) : priceGroup === 1 ? ['Меню Престо', 'Демо прайс'] : ['Прайс для кофейни', 'Прайс в ресторане на Московском'];
      for (const name of names) {
        const option = { id: name, name };
        if (matches(option)) { root.append(optionRow(option)); count++; }
      }
    } else {
      if (!query && !salesOnlySelected) root.append(el('div', 'sales-picker__company', 'Вся компания'));
      for (const group of SALES_GROUPS) {
        const groupMatches = group.name.toLocaleLowerCase('ru').includes(query);
        const points = group.points.filter((point) => (groupMatches || point.name.toLocaleLowerCase('ru').includes(query)) && (!salesOnlySelected || salesSelection.has(point.id)));
        if (!points.length) continue;
        const details = el('details', 'sales-picker__node');
        details.open = !!query || salesOnlySelected || salesExpanded.has(group.id);
        const summary = el('summary', 'sales-picker__group', '<span class="ico">&#xE96E;</span>');
        summary.append(document.createTextNode(group.name));
        const children = el('div', 'sales-picker__children');
        for (const point of points) { children.append(optionRow(point)); count++; }
        details.append(summary, children);
        details.addEventListener('toggle', () => {
          if (details.open) salesExpanded.add(group.id);
          else salesExpanded.delete(group.id);
        });
        root.append(details);
      }
      for (const point of ROOT_SALES) if (matches(point)) { root.append(optionRow(point)); count++; }
    }
    if (!count) root.append(el('p', 'sales-empty', 'Ничего не найдено'));
  }
  function salesPickerHeader() {
    const empty = !salesSelection.size;
    if (empty) salesOnlySelected = false; // показывать «только отмеченные» нечего
    $('#salesCount').textContent = 'Отмечено ' + salesSelection.size;
    $('#salesCount').setAttribute('aria-pressed', salesOnlySelected);
    $('#salesFilter').setAttribute('aria-pressed', salesOnlySelected);
    const all = $('#salesSelectAll');
    const options = salesPickerMode === 'points' ? SALES.map((point) => point.id) : [PRICE_CURRENT, ...PRICES];
    all.setAttribute('aria-label', salesPickerMode === 'points' ? 'Выбрать все точки продаж' : 'Выбрать все прайсы');
    $('#salesCount').setAttribute('aria-label', salesPickerMode === 'points' ? 'Показать только отмеченные точки' : 'Показать только отмеченные прайсы');
    all.hidden = false;
    // Пока ничего не отмечено — ни «Отмечено», ни чекбокса «Выбрать все»
    all.classList.toggle('is-empty', empty);
    $('#salesCount').hidden = empty;
    all.checked = options.every((id) => salesSelection.has(id));
    all.indeterminate = salesSelection.size > 0 && !all.checked;
  }
  for (const button of [$('#salesCount'), $('#salesFilter')]) button.addEventListener('click', () => {
    salesOnlySelected = !salesOnlySelected;
    salesPickerRender();
  });
  $('#salesSelectAll').addEventListener('change', (e) => {
    salesSelection = new Set(e.target.checked ? (salesPickerMode === 'points' ? SALES.map((point) => point.id) : [PRICE_CURRENT, ...PRICES]) : []);
    salesPickerRender();
  });
  $('#salesPickerDone').addEventListener('click', () => {
    let rows = salesCopy(salesCurrent());
    if (salesPickerMode === 'points') {
      rows = rows.filter((row) => salesSelection.has(row.id));
      for (const point of SALES) if (salesSelection.has(point.id) && !rows.some((row) => row.id === point.id)) rows.push({ id: point.id, price: point.price });
    } else {
      const row = rows.find((row) => row.id === salesPickerMode);
      if (row) {
        row.prices = [...salesSelection];
        row.price = row.prices.join(', ') || 'Выбрать прайс';
      }
    }
    // Выбор из окна компонента идёт в черновик окна: на сайт точки попадают только по «Сохранить» (галке) в окне
    if (salesDraft) salesDraft = salesCopy(rows);
    else salesSave(rows);
    salesPickerCancel();
    salesRender();
  });
  $('#salesSearch').addEventListener('input', salesPickerRender);
  $('#salesPickerClose').addEventListener('click', salesPickerCancel);
  $('#salesClose').addEventListener('click', salesClose);
  // Сохранённые точки продаж = компонент «Ресторан» настроен: он подключается (с зависимостями и страницами)
  function salesSave(rows) {
    salesSaved = salesCopy(rows);
    if (salesSaved.length && !compOn.has('restaurant')) { compConnect('restaurant', true); lsRender(); }
  }
  $('#salesDone').addEventListener('click', () => { salesSave(salesDraft); salesClose(); salesRender(); });
  $('#salesReset').addEventListener('click', () => { salesDraft = []; salesRender(); });
  // ---------- Настройки каталога (Figma WHZ4ZSm4wRMrxQPWqEk5Wk 2547:84587) ----------
  // Шестерёнка тулбара каталога открывает окно по левому верхнему углу виджета, повторный клик закрывает. Внутри пока только ховер.
  // Плитки — схемы из макета: [x, y, w, h, вид], вид f — заливка, b — рамка, d — пунктир; выбранная плитка — из макета.
  const CAT_TILES = {
    size: { w: 86, h: 86, items: [
      { name: 'Большой', rects: [[6, 6, 35, 35, 'f'], [45, 6, 35, 35, 'f'], [6, 45, 35, 35, 'b'], [45, 45, 35, 35, 'b']] },
      { name: 'Средний', on: true, rects: [0, 26, 52].flatMap((x) => [[x + 6, 6, 22, 22, 'f'], [x + 6, 32, 22, 22, 'f'], [x + 6, 58, 22, 22, 'b']]) },
      { name: 'Маленький', rects: [5, 25, 45, 65].flatMap((x) => [[x, 5, 16, 16, 'f'], [x, 25, 16, 16, 'f'], [x, 45, 16, 16, 'b'], [x, 65, 16, 16, 'b']]) },
    ] },
    toc: { w: 110, h: 92, items: [
      { name: 'Слева', rects: [...catTocLines(4), ...catTocGrid(56)] },
      { name: 'Справа', rects: [...catTocLines(60), ...catTocGrid(6)] },
      { name: 'Скрыто', on: true, w: 64, rects: catTocGrid(8) },
    ] },
    nav: { w: 74, h: 92, rows: [3, 2], items: [
      { name: 'Только разделы', rects: [0, 26, 52].flatMap((x) => [[x, 6, 22, 22, 'f'], [x, 32, 22, 22, 'f'], [x, 58, 22, 28, 'd']]) },
      { name: 'Карусель разделов', on: true, fit: true, rects: [0, 26, 52].flatMap((x) => [[x, 6, 22, 22, 'f'], [x, 32, 22, 25, 'b'], [x, 61, 22, 25, 'b']]) },
      { name: 'Только товары', rects: [0, 26, 52].flatMap((x) => [[x, 6, 22, 28, 'b'], [x, 38, 22, 28, 'b']]) },
      { name: 'Разделы в виде меню', rects: [[0, 18, 22, 3, 'f'], ...[0, 26, 52].flatMap((x) => [[x, 6, 22, 8, 'f'], [x, 26, 22, 28, 'b'], [x, 58, 22, 28, 'b']])] },
      { name: 'Динамическая плитка', rects: [[0, 6, 22, 22, 'f'], [0, 32, 22, 22, 'f'], [26, 6, 22, 48, 'f'], [52, 6, 22, 36, 'f'], [0, 58, 22, 28, 'b'], [26, 58, 22, 28, 'b'], [52, 58, 22, 28, 'b']] },
    ] },
  };
  // Оглавление: строки текста слева от сетки товаров (x — левый край строк) и сетка 2×3
  function catTocLines(x) {
    return [[0, 0, 40, 8], [6, 11, 40, 4], [6, 18, 40, 4], [6, 25, 34, 4], [0, 34, 40, 8], [6, 45, 40, 4], [6, 52, 40, 4], [6, 59, 34, 4]]
      .map(([dx, dy, w, h]) => [x + dx, 10 + dy, w, h, 'f', 2]);
  }
  function catTocGrid(x) {
    return [0, 26].flatMap((dx) => [[x + dx, 6, 22, 22, 'f'], [x + dx, 32, 22, 22, 'f'], [x + dx, 58, 22, 28, 'b']]);
  }
  for (const box of document.querySelectorAll('[data-cat-tiles]')) {
    const set = CAT_TILES[box.dataset.catTiles];
    const tiles = set.items.map((item) => {
      const tile = el('button', 'catset__tile' + (item.on ? ' is-selected' : '') + (item.fit ? ' catset__tile--fit' : ''), `<span class="catset__tile-name">${item.name}</span>`);
      tile.type = 'button';
      tile.setAttribute('aria-pressed', !!item.on);
      const pic = el('span', 'catset__pic');
      pic.style.width = (item.w ?? set.w) + 'px';
      pic.style.height = set.h + 'px';
      for (const [x, y, w, h, kind, r = 4] of item.rects) {
        const rect = el('i', 'catset__rect catset__rect--' + kind);
        Object.assign(rect.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: r + 'px' });
        pic.append(rect);
      }
      tile.append(pic);
      return tile;
    });
    if (!set.rows) { box.append(...tiles); continue; }
    let at = 0;
    for (const n of set.rows) {
      const row = el('div', 'catset__row');
      row.append(...tiles.slice(at, at += n));
      box.append(row);
    }
  }
  peDraggable($('#catSet'));
  // «Открывать товар» — тот же компонент, что «Способ отображения» в настройках страницы: своя подпись и два варианта
  const catSetOpenMode = openModeFill($('#catSet'), { title: 'Открывать товар', options: [['page', 'На странице'], ['window', 'В новом окне']] });
  catSetOpenMode.set('window');
  const catSetGear = $('#siteCatalogSettings');
  function catSetClose() {
    const root = $('#catSet');
    if (root.hidden) return;
    catSetOpenMode.close();
    root.hidden = true;
    catSetGear.classList.remove('is-selected');
    catSetGear.setAttribute('aria-pressed', 'false');
  }
  PropertyEditor.mount($('#catSet'), { onDone: catSetClose, onClose: catSetClose });
  // Окно настроек каталога открывается по шестерёнке в тулбаре (она же закрывает) и по клику на уже выделенный виджет:
  // первый клик выделяет, второй открывает — так же срабатывает и двойной клик.
  catSetGear.addEventListener('click', () => {
    if (!$('#catSet').hidden) { catSetClose(); return; }
    catSetOpen();
  });
  // Выделение ставит общий mousedown на сцене — раньше click. Поэтому «уже выделен» запоминается на mousedown самого виджета: он срабатывает до общего
  let catWasActive = false;
  $('#siteCatalog').addEventListener('mousedown', () => { catWasActive = $('#siteCatalog').classList.contains('is-active'); });
  $('#siteCatalog').addEventListener('click', (e) => {
    if (e.target.closest('.tb')) return; // клики по кнопкам тулбара — их собственные
    if (catWasActive && $('#catSet').hidden) catSetOpen();
  });
  function catSetOpen() {
    const root = $('#catSet');
    popupsClose();
    const r = stageRect($('#siteCatalog'));
    root.hidden = false;
    peMoveTo(root, r.left, r.top);
    catSetGear.classList.add('is-selected');
    catSetGear.setAttribute('aria-pressed', 'true');
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') catSetClose(); });
  stage.addEventListener('click', (e) => {
    if (e.target.closest('[data-sales-add]')) salesPickerOpen();
    const price = e.target.closest('[data-sales-price]');
    if (price) salesPickerOpen(price.dataset.salesPrice);
    const remove = e.target.closest('[data-sales-delete]');
    const primary = e.target.closest('[data-sales-primary]');
    if (!remove && !primary) return;
    let rows = salesCopy(salesCurrent());
    if (remove) rows = rows.filter((row) => row.id !== remove.dataset.salesDelete);
    else { const at = rows.findIndex((row) => row.id === primary.dataset.salesPrimary); rows.unshift(...rows.splice(at, 1)); }
    if (salesDraft) salesDraft = rows;
    else salesSaved = rows;
    salesRender();
  });
  // Перетаскивание строк точек продаж: порядок меняется, первая строка становится основной точкой
  let salesDragId = null;
  stage.addEventListener('dragstart', (e) => {
    const row = e.target.closest?.('[data-sales-row]');
    if (!row) return;
    salesDragId = row.dataset.salesRow;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', salesDragId);
    row.classList.add('is-drag');
  });
  stage.addEventListener('dragover', (e) => {
    const row = salesDragId && e.target.closest('[data-sales-row]');
    if (!row) return;
    e.preventDefault();
    const dragged = row.parentNode.querySelector('.is-drag');
    if (!dragged || dragged === row) return;
    const r = row.getBoundingClientRect();
    row.parentNode.insertBefore(dragged, e.clientY < r.top + r.height / 2 ? row : row.nextSibling);
  });
  stage.addEventListener('drop', (e) => { if (salesDragId) e.preventDefault(); });
  stage.addEventListener('dragend', (e) => {
    const dragged = e.target.closest?.('[data-sales-row]');
    if (!salesDragId || !dragged) return;
    salesDragId = null;
    const order = [...dragged.parentNode.querySelectorAll('[data-sales-row]')].map((row) => row.dataset.salesRow);
    const rows = salesCopy(salesCurrent()).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    if (salesDraft) salesDraft = rows;
    else salesSaved = rows;
    salesRender();
  });
  // Esc отменяет только верхнее окно; родитель остаётся открыт.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || (salesPicker.hidden && salesPopup.hidden)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!salesPicker.hidden) salesPickerCancel();
    else salesClose();
  }, true);
  salesRender();

  // «Магазин»: статика с ховером
  $('#rsSmall').innerHTML = ['E6D3', 'EAC3', 'EAEE', 'EA80'].map((g) => `<div class="rs-cell"><span class="ico24">&#x${g};</span></div>`).join('');
  const SHOP_ITEMS = [
    ['EAC9', 'Текст'], ['EBD3', 'Заголовок'], ['E9A3', 'Изображение'], ['E929', 'Видео'], ['E739', 'Файл'],
    ['EB7E', 'Отправить ответ'], ['E6CC', 'Таблица'], ['E63D', 'Наименование'], ['EA5F', 'Заказать'],
  ];
  // пустая ячейка держит «Заказать» в ширину половины ряда
  $('#rsMedium').innerHTML = SHOP_ITEMS.map(([g, t]) => `<div class="rs-item"><span class="ico">&#x${g};</span>${t}</div>`).join('') + '<div class="rs-item rs-item--empty"></div>';
  // [название, описание, высота, картинка, белая подложка, положение картинки из макета, файл картинки, если не <картинка>.png]
  const COVER = 'inset:0;width:100%;height:100%;object-fit:cover';
  const CONTAIN = 'inset:0;width:100%;height:100%;object-fit:contain';
  // Каталог — один, виджет компонента «Ресторан»
  const SHOP_WIDGETS = [
    ['Каталог', 'Виджет товаров и услуг, доступных в вашем заведении', 290, 'catalog', false, CONTAIN, 'catalog-menu.svg'],
    // Виджеты после каталога — Figma 8hkrT2mgrsbZ6zH254V6Y0 14925:60682. Часть превью вырезана из общих картинок (*-sprite.png)
    ['Плавающие кнопки', 'Кнопки заказа, бронирования и чата', 115, 'floating'],
    ['Бонусы', 'Виджет позволяет вступить в программу лояльности и следить за балансом бонусов', 221, 'bonuses'],
    ['Абонементы и сертификаты', 'С помощью виджета клиент может купить сертификат себе или в подарок', 211, 'certificates', false, 'left:-2.45%;top:-158.55%;width:105.83%;height:500%', 'promo-sprite.png'],
    ['Реклама', 'Привлекайте больше клиентов. Виджет покажет объявления для разных заведений и устройств', 333, 'ads', false, 'left:-2.45%;top:-170.8%;width:105.83%;height:277.37%', 'promo-sprite.png'],
    ['Характеристики', 'Виджет позволяет настроить теги (характеристики) заведения для удобства поиска', 133, 'features', false, 'left:-1.23%;top:-6.76%;width:104.29%;height:120.27%'],
    ['Адрес', 'Местонахождение вашего заведения', 96, 'address', false, 'left:-2.47%;top:-486.71%;width:106.17%;height:882.86%', 'place-sprite.png'],
    ['Режим работы', 'Виджет настройки режима работы заведения', 125, 'hours', false, 'left:-2.47%;top:-448.26%;width:106.17%;height:566.78%', 'place-sprite.png'],
    ['Контакты', 'Виджет настройки контактной информации', 215, 'place-contacts', false, 'left:-4.32%;top:-10.01%;width:108.64%;height:255.63%'],
    ['Описание', 'Текстовый виджет для детального описания деятельности вашего заведения', 221, 'description', false, 'left:-2.76%;top:-8.64%;width:105.83%;height:425.93%', 'text-sprite.png'],
    ['О компании', 'Текстовый виджет для отображения информации о контрагенте', 103, 'about', false, 'left:-2.76%;top:-570.45%;width:105.83%;height:1568.18%', 'text-sprite.png'],
    ['3D-тур', 'Виджет для показа 3D-тура по заведению', 370, 'tour', false, 'left:-2.76%;top:-108.9%;width:105.83%;height:211.66%', 'text-sprite.png'],
    ['Галерея', 'Виджет показывает загруженные изображения', 214, 'gallery', false, 'left:-1.84%;top:-6.47%;width:105.52%;height:314.12%', 'media-sprite.png'],
    ['Новости', 'Виджет отображает последние свежие новости', 322, 'news', false, 'left:-1.84%;top:-86.69%;width:105.52%;height:192.09%', 'media-sprite.png'],
    ['Промокоды', 'Показывает активные промокоды, доступные для использования клиентами', 363, 'promo', false, 'left:-4.29%;top:-4.28%;width:106.44%;height:107.24%'],
    ['События', 'Расскажите о мероприятиях и курсах в вашем заведении', 390, 'events', false, 'left:-7.36%;top:-6.04%;width:115.34%;height:173.11%', 'feed-sprite.png'],
    ['Отзывы', 'Виджет показывает отзывы заведения', 192, 'reviews', false, 'left:-7.36%;top:-277.7%;width:115.34%;height:387.16%', 'feed-sprite.png'],
    ['Профиль', 'Виджет профиля с возможностью изменения личных данных пользователя', 239, 'profile', false, 'left:-2.47%;top:-2.23%;width:104.94%;height:107.82%'],
  ];
  // Превью, собранные вёрсткой вместо картинки. Кнопки — в оформлении сайта, как «Подробнее о нас» (.site-btn)
  const SHOP_PREVIEWS = {
    // корзина и «Заказать» — одна плашка, чат — отдельная круглая кнопка
    floating: '<div class="rs-fab"><div class="rs-fab__order"><span class="ico24 rs-fab__cart">&#xEA5F;</span><span class="site-btn rs-fab__btn">Заказать</span></div><span class="ico24 site-btn rs-fab__chat">&#xE90F;</span></div>',
    bonuses: '<div class="rs-bonus"><div class="rs-bonus__title">Кэшбек 5% и 150 бонусов в подарок</div><div class="rs-bonus__sub">Наша программа лояльности</div><span class="site-btn rs-bonus__btn">Присоединиться</span></div>',
  };
  const shopWidgetsHtml = (list) => list.map(([name, desc, h, img, white, pos, file = img + '.png']) =>
    `<div class="rs-w${img.startsWith('catalog') ? ' rs-w--catalog' : ''}" data-widget="${img}" style="height:${h}px"><div><div class="rs-w__name">${name}</div><div class="rs-w__desc">${desc}</div></div>` +
    `<div class="rs-w__pv${white ? ' rs-w__pv--white' : ''}"><div class="rs-w__img">${SHOP_PREVIEWS[img] || `<img src="assets/img/shop/${file}" alt="" style="${pos}">`}</div><span class="ico24 rs-w__plus">&#xEAE9;</span></div></div>`).join('');
  $('#rsWidgets').innerHTML = shopWidgetsHtml(SHOP_WIDGETS);

  // Виджет на фрейме: клик по «Каталогу» в магазине ставит его в зону контента секции вместо пустой ячейки и выделяет,
  // каталог пропадает из магазина, появляется страница «Карточка товара». Удаление виджета возвращает всё обратно.
  // Выделение — .is-active у .wg: снимается кликом мимо, клик по виджету ставит снова. «Удалить» в тулбаре возвращает пустую ячейку.
  for (const cell of document.querySelectorAll('.site-empty')) cell.prepend($('#siteEmptyContent').content.cloneNode(true));
  for (const tb of document.querySelectorAll('[data-section-cmds]')) tb.append($('#sectionCmds').content.cloneNode(true));
  for (const footer of document.querySelectorAll('[data-site-footer]')) footer.append($('#siteFooter').content.cloneNode(true));
  const siteSection = $('#siteSection');
  const siteCatalog = $('#siteCatalog');
  // Демоданные: пока у компонента нет точек продаж, вместо фото блюд — демо-фото, те же, что в превью «Каталог» (.is-demo ставит salesRender)
  siteCatalog.querySelectorAll('.site-card__img, .site-cat').forEach((box, i) => {
    const demo = el('img', 'site-demo');
    demo.src = `assets/img/site/demo/dish-${i % 6 + 1}.jpg`;
    demo.alt = '';
    box.prepend(demo);
  });
  const siteContent = $('#content');
  const siteMain = $('#site');
  const siteBlank = $('#siteBlank');
  const siteBlankSection = $('#siteBlankSection');
  const siteBlankCell = $('#siteBlankCell');
  const siteProduct = $('#siteProduct');

  // Fixed привязан к масштабируемой сцене и выходит из overflow прокручиваемого контента.
  // Оставляем настоящий тулбар внутри виджета: выделение, ховер и обработчики кнопок сохраняются.
  const widgetToolbars = [...siteContent.querySelectorAll('.wg__toolbar')];
  let toolbarFrame = 0;
  function positionWidgetToolbars() {
    toolbarFrame = 0;
    for (const toolbar of widgetToolbars) {
      const widget = toolbar.parentElement;
      if (!widget.getClientRects().length) continue;
      const r = stageRect(widget);
      const h = toolbar.getBoundingClientRect().height / scale;
      // Целые пиксели: дробные координаты при каждом пересчёте дают субпиксельный сдвиг — текст «прыгает».
      const left = Math.round(r.left) + 'px';
      const top = Math.round(Math.max(6, r.top - h - 8)) + 'px';
      if (toolbar.style.getPropertyValue('--widget-toolbar-left') !== left) toolbar.style.setProperty('--widget-toolbar-left', left);
      if (toolbar.style.getPropertyValue('--widget-toolbar-top') !== top) toolbar.style.setProperty('--widget-toolbar-top', top);
    }
  }
  function scheduleWidgetToolbars() {
    if (!toolbarFrame) toolbarFrame = requestAnimationFrame(positionWidgetToolbars);
  }
  siteContent.addEventListener('scroll', scheduleWidgetToolbars, { passive: true });
  window.addEventListener('resize', scheduleWidgetToolbars);
  new ResizeObserver(scheduleWidgetToolbars).observe(siteContent);
  new MutationObserver(scheduleWidgetToolbars).observe(stage, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  scheduleWidgetToolbars();

  const shopCatalog = $('#rsWidgets [data-widget="catalog"]').closest('.rs-w');
  // «Карточки товара» и «Корзины» в магазине нет: карточку приносит компонент. Виджет карточки живёт вне магазина, чтобы её логика не ломалась
  const shopProduct = el('div', null, shopWidgetsHtml([['Карточка товара', 'Для отображения товара со всеми его свойствами', 357, 'product', true, CONTAIN]])).firstChild;
  // Подсказка клика: видна там, где карточку можно поставить — на новой странице без карточки
  const shopProductPin = el('span', 'pin', '<img src="assets/img/pin-cursor.svg" width="15" height="15" alt="">');
  shopProductPin.setAttribute('aria-hidden', 'true');
  $('.rs-w__pv', shopProduct).append(shopProductPin);
  // Подсказка клика на «Каталог»: видна, пока каталога нет на сайте (сам виджет из магазина не уходит). Стоит у заголовка, а не на превью
  const shopCatalogPin = el('span', 'pin', '<img src="assets/img/pin-cursor.svg" width="15" height="15" alt="">');
  shopCatalogPin.setAttribute('aria-hidden', 'true');
  $('.rs-w__name', shopCatalog).classList.add('rs-w__name--pin');
  $('.rs-w__name', shopCatalog).append(shopCatalogPin);

  function siteCatalogShow(on) {
    siteCatalog.hidden = !on;
    $('.site-empty', siteSection).hidden = on;
    siteSection.classList.toggle('has-widget', on);
  }
  function catalogHomeSet(on) {
    catalogHome = on;
    siteMain.classList.toggle('is-catalog-home', on);
  }
  // «Каталог» встаёт на главную и подключает «Ресторан» со всей цепочкой зависимостей и их страницами.
  // Окно настроек открывается, только если компонент ещё не настроен (нет точек продаж), иначе виджет берёт настройки компонента.
  function siteAddCatalog() {
    if (catalogAdded) return;
    const home = lsPages.find((p) => p.home);
    if (!home) return; // главную удалили — ставить некуда
    if (lsActive !== home.id) lsSelect(home.id);
    catalogHomeSet(true);
    catalogAdded = true;
    shopCatalogPin.hidden = true;
    compConnect('restaurant', true);
    siteCatalogShow(true);
    siteCatalog.classList.add('is-active');
    lsRender();
    salesRender(); // окно точек продаж при добавлении каталога не открываем
  }
  // Удаление виджета не трогает компонент и его страницы: они уходят только вместе с компонентом
  function siteRemoveCatalog() {
    salesClose();
    catSetClose();
    catalogAdded = false;
    if (catalogMenu) { // каталог «Меню» уходит только с компонентом, а с ним и страница: дальше каталог снова ставится на главную
      catalogMenu = false;
      catalogHomeSet(true);
    }
    salesRender();
    if (stage.dataset.scenario !== 'typical') { // в типовом заполнении сценарий остаётся: удалили один виджет заполненного сайта
      scenSyncing = true;
      frame.select('catalog-add');
      scenSyncing = false;
    }
    shopCatalogPin.hidden = false;
    siteCatalogShow(false);
    siteCatalog.classList.remove('is-active');
  }
  // Подключение: сначала сам компонент, потом его зависимости. Уже подключённый компонент возвращает свои страницы, если их удалили вместе с виджетом
  function compConnect(id, root = false) {
    if (root) compRoots.add(id);
    compOn.add(id);
    COMP[id].pages.forEach((name, i) => {
      if (lsPages.some((p) => p.comp === id && p.name === name)) return;
      const widgetPage = name === COMP[id].widgetPage;
      const page = { id: lsNextId++, name, off: false, blank: true, mode: 'page', fixed: true, comp: id, widgetPage, product: widgetPage, compWidget: COMP[id].widgets?.[name] };
      // вернувшаяся страница встаёт на своё место среди страниц компонента
      const order = (p) => p.comp === id ? COMP[id].pages.indexOf(p.name) : -1;
      const after = lsPages.findLastIndex((p) => p.comp === id && order(p) < i);
      const before = lsPages.findIndex((p) => order(p) > i);
      lsPages.splice(after >= 0 ? after + 1 : before >= 0 ? before : lsPages.length, 0, page);
    });
    for (const dep of COMP[id].deps) compConnect(dep);
  }
  // Компонент подключён, а его виджета на сайте нет: приходит страница для виджета («Меню») — первой в группе компонента, с виджетом на ней
  function compAddWidgetHome(id) {
    const c = COMP[id];
    if (!c.widgetHome || catalogAdded) return;
    const page = { id: lsNextId++, name: c.widgetHome, off: false, mode: 'page', fixed: true, comp: id, menu: true };
    const at = lsPages.findIndex((p) => p.comp === id);
    lsPages.splice(at >= 0 ? at : lsPages.length, 0, page);
    catalogHomeSet(false);
    catalogMenu = true;
    catalogAdded = true;
    shopCatalogPin.hidden = true;
    siteCatalogShow(true);
    siteCatalog.classList.remove('is-active');
  }
  function compDropPages(match) {
    lsPages = lsPages.filter((p) => !match(p));
    if (!lsPage(lsActive)) lsActive = (lsPages.find((p) => p.home) ?? lsPages[0]).id;
    lsRender();
  }
  // Отключение компонента: уходят только его страницы (и его виджет, его настройки). Другие компоненты — ни зависящие от него, ни его зависимости — остаются
  function compRemoveSet(id) {
    return [id];
  }
  // Сначала окно: какие компоненты отключатся вместе с ним и что уйдёт с сайта — страницы и виджет
  function compRemoveAsk(id) {
    const ids = compRemoveSet(id);
    const pages = lsPages.filter((p) => ids.includes(p.comp));
    const widget = catalogAdded && ids.includes('restaurant');
    const others = ids.filter((c) => c !== id);
    // «Вместе с ним отключатся компоненты «…». Удалятся страницы «…» и виджет «…»»
    const lines = [];
    if (others.length) lines.push(`Вместе с ним ${others.length > 1 ? 'отключатся компоненты' : 'отключится компонент'} ` + others.map((c) => `«${COMP[c].name}»`).join(', ') + '.');
    const parts = [];
    if (pages.length) parts.push((pages.length > 1 ? 'страницы ' : 'страница ') + pages.map((p) => `«${p.name}»`).join(', '));
    if (widget) parts.push(`виджет «${COMP.restaurant.widget}»`);
    if (parts.length) lines.push(`${pages.length > 1 || parts.length > 1 ? 'Удалятся' : 'Удалится'} ${parts.join(' и ')}.`);
    salesClose();
    confirmAsk({
      message: `Отключить компонент «${COMP[id].name}»?`,
      details: lines.join(' '),
      answers: [['yes', 'Да', true], ['cancel', 'Отмена']],
    }, (answer) => { if (answer === 'yes') compRemove(ids, widget); });
  }
  function compRemove(ids, widget) {
    for (const c of ids) { compOn.delete(c); compRoots.delete(c); }
    if (widget) siteRemoveCatalog();
    if (ids.includes('restaurant')) salesSaved = []; // настройки компонента — точки продаж — уходят с ним
    compDropPages((p) => ids.includes(p.comp));
    salesRender();
  }
  // Чипса подключает компонент, крестик группы отключает (с подтверждением):
  // приходят его страницы и зависимости со своими страницами
  stage.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-comp-toggle], [data-comp-add]');
    if (toggle) {
      const id = toggle.dataset.compToggle || toggle.dataset.compAdd;
      if (compOn.has(id)) { compRemoveAsk(id); return; }
      compConnect(id, true);
      compAddWidgetHome(id);
      lsRender();
      salesRender();
      return;
    }
  });

  // Подтверждение (Figma nuC4KFMiS36uDWDUp9wKGl 4064:21938, как в interface-prototype): по центру сцены, поверх всего. Esc — последний ответ («Отмена»)
  const confirmLayer = $('#confirm');
  let confirmDone = null;
  function confirmAsk({ message, details, answers }, onAnswer) {
    $('#confirmMsg').textContent = message;
    $('#confirmDetails').textContent = details ?? '';
    $('#confirmDetails').hidden = !details;
    $('#confirmFooter').replaceChildren(...answers.map(([id, caption, primary]) => {
      const b = el('button', 'confirm__btn' + (primary ? ' confirm__btn--primary' : ''));
      b.type = 'button';
      b.dataset.answer = id;
      b.textContent = caption;
      return b;
    }));
    confirmLayer.hidden = false;
    confirmDone = (answer) => onAnswer(answer ?? answers.at(-1)[0]);
  }
  function confirmClose(answer) {
    confirmLayer.hidden = true;
    const done = confirmDone;
    confirmDone = null;
    done?.(answer);
  }
  confirmLayer.addEventListener('mousedown', (e) => e.stopPropagation()); // клик в окне не закрывает остальные окна и не снимает выделение
  confirmLayer.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('[data-answer]');
    if (b) confirmClose(b.dataset.answer);
  });
  window.addEventListener('keydown', (e) => {
    if (confirmLayer.hidden || e.key !== 'Escape') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    confirmClose();
  }, true);

  $('#rsWidgets').addEventListener('click', (e) => {
    if (e.target.closest('[data-widget="catalog"]')) siteAddCatalog();
    if (e.target.closest('[data-widget="product"]')) siteAddProduct();
  });
  // каталог на «Меню» компонента — основной виджет страницы и не удаляется
  const siteDeleteCatalog = () => { if (!catalogMenu) siteRemoveCatalog(); };
  $('#siteCatalogDelete').addEventListener('click', siteDeleteCatalog);

  // Новая страница и страницы компонентов (blank) — вместо сайта пустая секция под шапкой сайта, на ней ничего не выделено.
  let siteShown = null;
  let sitePage = null; // открытая страница
  // На открытой странице ничего не выделено: выделение появляется только кликом
  function siteClearSelection() {
    for (const widget of [siteCatalog, siteProduct, siteSection, siteBlankSection]) widget.classList.remove('is-active');
  }
  function siteShowPage(page) {
    if (page.id === siteShown) return;
    siteShown = page.id;
    siteMain.hidden = !!page.blank;
    // Главная — баннер и «О нас», на «Меню» — только секция с каталогом. В сценариях компонентов каталог стоит на главной между ними
    siteMain.classList.toggle('is-home', !!page.home);
    if (catalogHome) siteCatalogShow(catalogAdded);
    const hasCatalog = !page.blank && !siteCatalog.hidden && (catalogHome ? !!page.home : !page.home);
    if (!hasCatalog) salesClose(); // каталога на открытой странице нет
    siteBlank.hidden = !page.blank;
    siteContent.scrollTop = 0;
    secClose();
    bgClose();
    siteClearSelection();
    sitePage = page;
    secApply(page.section, siteBlankSection);
    paintFill(siteBlankSection, page.sectionFill, '', BG_DEFAULT);
    // каталог на «Меню» компонента — основной виджет страницы: нет «Удалить» ни у виджета, ни у секции
    $('#siteCatalogDelete').hidden = !!page.menu;
    $('[data-sec-cmd="delete"]', siteSection).hidden = !!page.menu;
    siteProductRender(!!(page.product || page.compWidget));
  }

  // Карточка товара: клик в магазине ставит её в зону контента секции новой страницы вместо пустой ячейки и выделяет, из магазина она пропадает.
  // На странице с контентом клик ничего не делает. «Удалить» в тулбаре возвращает пустую ячейку и виджет в магазин, удаление страницы с карточкой — тоже.
  function siteProductSyncShop() {
    shopProduct.hidden = lsPages.some((p) => p.product);
  }
  // Демоданные виджетов страниц компонентов: макетов пока нет, вид — в стиле сайта «Мили». Покупатель, адреса и заказы вымышленные
  const CW_IMG = 'assets/img/site/catalog/';
  const cwThumbs = (...imgs) => `<span class="pgw-thumbs">${imgs.map((img) => `<img src="${CW_IMG}${img}.png" alt="">`).join('')}</span>`;
  const cwItem = (img, name, qty, price) =>
    `<div class="pgw-item"><img src="${CW_IMG}${img}.png" alt=""><div class="pgw-item__name">${name}<span>${qty} шт.</span></div><div class="pgw-price">${price} ₽</div></div>`;
  const COMP_DEMO = {
    'Вход и регистрация':
      '<div class="pgw-auth">' +
        '<div class="pgw-tabs"><span class="is-on">Вход</span><span>Регистрация</span></div>' +
        '<label class="pgw-field"><span>Телефон</span><b>+7 (910) 555-12-34</b></label>' +
        '<label class="pgw-field"><span>Код из СМС</span><b class="pgw-field__empty">— — — —</b></label>' +
        '<span class="pgw-btn">Получить код</span>' +
        '<div class="pgw-note">Повторно отправить код можно через 0:59</div>' +
        '<div class="pgw-note">Нажимая кнопку, вы соглашаетесь с условиями обработки персональных данных</div>' +
      '</div>',
    'Профиль покупателя':
      '<div class="pgw-profile">' +
        '<div class="pgw-person"><span class="pgw-avatar">АС</span><div><div class="pgw-person__name">Анна Смирнова</div><div class="pgw-muted">+7 (910) 555-12-34 · anna.smirnova@example.ru</div></div></div>' +
        '<div class="pgw-stats">' +
          '<div class="pgw-stat"><b>1 240</b><span>бонусных баллов</span></div>' +
          '<div class="pgw-stat"><b>14</b><span>заказов</span></div>' +
          '<div class="pgw-stat"><b>Мили</b><span>на Московском — любимый ресторан</span></div>' +
        '</div>' +
        '<div class="pgw-h">Адреса доставки</div>' +
        '<div class="pgw-row"><b>Дом</b><span>Ярославль, ул. Свободы, 12, кв. 45</span><span class="pgw-tag">основной</span></div>' +
        '<div class="pgw-row"><b>Работа</b><span>Ярославль, пр-т Октября, 56, офис 310</span></div>' +
      '</div>',
    'Корзина':
      '<div class="pgw-card">' +
        cwItem('pepperoni', 'Пепперони', 2, '1 300') +
        cwItem('tuna', 'Севиче из тунца', 1, '1 350') +
        '<div class="pgw-sum"><span>Доставка</span><span>0 ₽</span></div>' +
        '<div class="pgw-sum pgw-sum--total"><span>Итого</span><span>2 650 ₽</span></div>' +
        '<span class="pgw-btn">Оформить заказ</span>' +
      '</div>',
    'История заказов':
      '<div class="pgw-orders">' +
        `<div class="pgw-order"><div><b>№ 10482</b><span class="pgw-muted">6 ноября, 19:40 · Доставка</span></div>${cwThumbs('pepperoni', 'tuna')}<span class="pgw-status pgw-status--ok">Доставлен</span><div class="pgw-price">2 000 ₽</div></div>` +
        `<div class="pgw-order"><div><b>№ 10431</b><span class="pgw-muted">31 октября, 13:15 · Самовывоз</span></div>${cwThumbs('langoustine', 'tuna', 'pepperoni')}<span class="pgw-status pgw-status--ok">Выдан</span><div class="pgw-price">2 540 ₽</div></div>` +
        `<div class="pgw-order"><div><b>№ 10397</b><span class="pgw-muted">24 октября, 20:05 · Доставка</span></div>${cwThumbs('pepperoni')}<span class="pgw-status pgw-status--off">Отменён</span><div class="pgw-price">650 ₽</div></div>` +
      '</div>',
    'Карточка заказа':
      '<div class="pgw-card">' +
        '<div class="pgw-muted">Заказ № 10482 от 6 ноября 2026, 19:40</div>' +
        '<div class="pgw-steps"><span class="is-done">Принят</span><span class="is-done">Готовится</span><span class="is-done">В пути</span><span class="is-on">Доставлен</span></div>' +
        cwItem('pepperoni', 'Пепперони', 1, '650') +
        cwItem('tuna', 'Севиче из тунца', 1, '1 350') +
        '<div class="pgw-sum"><span>Доставка</span><span>0 ₽</span></div>' +
        '<div class="pgw-sum"><span>Начислено баллов</span><span>+100</span></div>' +
        '<div class="pgw-sum pgw-sum--total"><span>Итого</span><span>2 000 ₽</span></div>' +
        '<div class="pgw-row"><b>Адрес</b><span>Ярославль, ул. Свободы, 12, кв. 45</span></div>' +
        '<div class="pgw-row"><b>Оплата</b><span>Картой онлайн · оплачен</span></div>' +
        '<span class="pgw-btn">Повторить заказ</span>' +
      '</div>',
  };
  function siteProductRender(on) {
    siteProduct.hidden = !on;
    siteProduct.classList.toggle('site-product--comp', !!sitePage.compWidget); // виджет страницы компонента (вход, профиль, заказы)
    if (sitePage.compWidget) {
      $('.site-compw__name', siteProduct).textContent = sitePage.compWidget;
      $('.site-compw__body', siteProduct).innerHTML = COMP_DEMO[sitePage.compWidget] ?? '';
    }
    $('.tb', siteProduct).setAttribute('aria-label', sitePage.compWidget || 'Карточка товара');
    shopProductPin.hidden = on || siteBlank.hidden;
    siteBlankCell.hidden = on;
    siteBlankSection.classList.toggle('has-widget', on);
    // Страница пришла с компонентом — её основной виджет (карточка товара/блюда) удалить нельзя: нет «Удалить» ни у виджета, ни у его секции
    // То же у страницы товара сайта (productPage): её виджет «Товар» не удаляется
    const locked = on && (!!sitePage.comp || !!sitePage.productPage);
    $('#siteProductDelete').hidden = locked;
    $('[data-sec-cmd="delete"]', siteBlankSection).hidden = locked;
    siteProduct.classList.remove('is-active');
    siteBlankSection.classList.remove('is-active');
  }
  function siteAddProduct() {
    if (siteBlank.hidden || sitePage.product || sitePage.compWidget) return;
    sitePage.product = true;
    siteProductSyncShop();
    siteProductRender(true);
    if (!secRoot.hidden) siteBlankSection.classList.add('is-active'); // пока открыты настройки секции, выделена секция
    else siteProduct.classList.add('is-active');
  }
  function siteRemoveProduct() {
    if (sitePage.comp || sitePage.productPage) return; // основной виджет страницы компонента и страницы товара не удаляется
    sitePage.product = false;
    siteProductSyncShop();
    siteProductRender(false);
    siteBlankSection.classList.add('is-active');
  }
  $('#siteProductDelete').addEventListener('click', siteRemoveProduct);
  // «Назад» поднимает на уровень секции
  $('#siteProductBack').addEventListener('click', () => {
    siteProduct.classList.remove('is-active');
    siteBlankSection.classList.add('is-active');
  });

  stage.addEventListener('mousedown', (e) => {
    if (secRoot.hidden && !e.target.closest('#bgWin')) { // пока открыты настройки секции или окно «Фон», выделение остаётся
      const inSection = !!e.target.closest('#siteBlankSection');
      const inProduct = !!e.target.closest('#siteProduct');
      siteBlankSection.classList.toggle('is-active', inSection && !inProduct);
      siteProduct.classList.toggle('is-active', inProduct);
      // Секция каталога выделяется кликом мимо своего виджета, как остальные секции
      siteSection.classList.toggle('is-active', !!e.target.closest('#siteSection') && !e.target.closest('#siteCatalog'));
      if (!secNode.classList.contains('is-active')) bgClose(); // тулбар с командой скрылся
    }
    if (siteCatalog.hidden) return;
    if (!e.target.closest('#salesPopup, #salesPicker, #catSet, #rsParams, .rp-btn')) siteCatalog.classList.toggle('is-active', !!e.target.closest('#siteCatalog'));
  });
  // «Назад» поднимает на уровень секции — у каталога, как у карточки товара
  $('#siteCatalogBack').addEventListener('click', () => {
    siteCatalog.classList.remove('is-active');
    siteCatalog.parentElement.classList.add('is-active');
  });
  // Родитель выделенного виджета — .wg--level-2 из кита: только пунктир, кнопки «+ секция» есть лишь у активной секции. Общее правило для всех секций, как бы ни поставилось выделение
  const SITE_PARENTS = [siteSection, siteBlankSection];
  function siteParentsSync() {
    for (const parent of SITE_PARENTS) {
      const on = !!parent.querySelector('.wg.is-active');
      if (parent.classList.contains('wg--level-2') !== on) parent.classList.toggle('wg--level-2', on);
    }
  }
  new MutationObserver(siteParentsSync).observe(siteContent, { subtree: true, attributes: true, attributeFilter: ['class'] });
  // «Удалить» в тулбаре секции удаляет и виджет внутри неё
  $('[data-sec-cmd="delete"]', siteSection).addEventListener('click', () => { if (!siteCatalog.hidden) siteDeleteCatalog(); });
  $('[data-sec-cmd="delete"]', siteBlankSection).addEventListener('click', () => { if (sitePage.product) siteRemoveProduct(); });

  // Свойство «Способ отображения» — строка с меню. Разметка в <template id="openMode">, поведение здесь. Окно задаёт свою подпись и список вариантов.
  // Меню без заголовка: первый пункт на уровне строки, текст пунктов — под значением. Клик мимо и Esc закрывают только меню.
  function openModeFill(root, { title, options }) {
    const parts = $('#openMode').content.cloneNode(true);
    const row = $('.open-mode', parts);
    const button = $('.open-mode__value', parts);
    const menu = $('.open-mode__menu', parts);
    $('.pe__label', row).textContent = title;
    menu.setAttribute('aria-label', title);
    const sample = $('[data-mode]', menu);
    const list = sample.parentNode;
    sample.remove();
    for (const [mode, text] of options) {
      const item = sample.cloneNode(true);
      item.dataset.mode = mode;
      $('.mw-menu__text', item).textContent = text;
      list.append(item);
    }
    $('[data-open-mode]', root).replaceWith(row);
    root.append(menu);
    const close = () => {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    };
    const control = {
      row,
      button,
      close,
      get isOpen() { return !menu.hidden; },
      get mode() { return menu.querySelector('.is-selected').dataset.mode; },
      set(mode) {
        menu.querySelectorAll('[data-mode]').forEach((item) => {
          const on = item.dataset.mode === mode;
          item.classList.toggle('is-selected', on);
          item.setAttribute('aria-checked', on);
          if (on) button.textContent = item.textContent;
        });
      },
    };
    button.addEventListener('click', () => {
      if (!menu.hidden) { close(); return; }
      const r = stageRect(button);
      const box = stageRect(root);
      menu.hidden = false;
      menu.style.left = Math.round(r.left - box.left - 30) + 'px';
      menu.style.top = Math.round(r.top + r.height / 2 - box.top - 22) + 'px';
      button.setAttribute('aria-expanded', 'true');
    });
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-mode]');
      if (item) control.set(item.dataset.mode);
      if (item || e.target.closest('.mw-menu__close')) close();
    });
    document.addEventListener('mousedown', (e) => { if (!menu.contains(e.target) && !button.contains(e.target)) close(); });
    return control;
  }

  // Заливка секции на холсте. Картинка — отдельным слоем (.ws-fill-img::before), остальное — фоном элемента. base — подложка под градиентом
  function paintFill(node, fill, empty = '', base = '') {
    const img = fill?.kind === 'img';
    node.classList.toggle('ws-fill-img', img);
    if (!img) {
      for (const p of ['--fill-img', '--fill-op', '--fill-filter', '--fill-tint']) node.style.removeProperty(p);
      node.style.background = !fill ? empty : fill.kind === 'grad' ? bgGradCss(fill, base) : bgColorCss(fill);
      return;
    }
    const f = fill.fx;
    // температура: тёплый или холодный оттенок поверх картинки (soft-light)
    const tint = f.temp > 0 ? `255, 140, 0, ${(f.temp / 100 * .6).toFixed(2)}` : `0, 110, 255, ${(-f.temp / 100 * .6).toFixed(2)}`;
    node.style.background = 'none';
    node.style.setProperty('--fill-img', `url(${BG_IMGS[fill.i]})`);
    node.style.setProperty('--fill-op', f.op / 100);
    node.style.setProperty('--fill-filter', `blur(${f.blur / 5}px) contrast(${f.con}%) saturate(${f.sat}%)`);
    node.style.setProperty('--fill-tint', `linear-gradient(rgba(${tint}), rgba(${tint}))`);
  }

  // Настройки секции: открываются по левому верхнему углу секции, шестерёнка в это время активна. Правки сразу видны на холсте, галочка сохраняет их в страницу,
  // крестик и Esc возвращают прежнее, сброс — исходные значения. Клик мимо не закрывает. Пока настроек нет, отступы секции — из стилей, поэтому в полях их фактические значения.
  // В макете есть только ширина «Узкая», «Широкая» и «Во всю ширину» — допущение. «Действие» и «Закрепить снизу» пока без действий.
  const SEC_NAME = 'Секция';
  const SEC_WIDTHS = { narrow: { name: 'Узкая', px: 1024 }, wide: { name: 'Широкая', px: 1280 }, full: { name: 'Во всю ширину', px: null } };
  const secRoot = $('#sec');
  peDraggable(secRoot);
  // Команды тулбара секции работают одинаково у всех секций: «Настройки» открывает это окно, «Фон» — окно «Фон».
  // Данные секции новой страницы лежат в странице, у секции каталога — в своём объекте.
  const SEC_NODES = [siteBlankSection, siteSection];
  let secNode = siteBlankSection;
  const secStore = new Map([[siteSection, {}]]);
  const secData = () => secStore.get(secNode) ?? sitePage;
  const secNameInput = $('#secName');
  const secWidth = $('#secWidth');
  const secWidthMenu = $('#secWidthMenu');
  const secPx = $('#secPx');
  const secGap = $('#secGap');
  const secFillBtn = $('#secFill');
  let secDraft = null; // значения, пока открыты настройки

  $('.pe__menu-list', secWidthMenu).innerHTML = Object.entries(SEC_WIDTHS).map(([id, w]) =>
    `<button type="button" class="pe__menu-item" role="menuitemradio" data-width="${id}"><span class="pe__menu-bullet"></span>${w.name}</button>`).join('');

  const secContentWidth = (sec) => sec.px ?? SEC_WIDTHS[sec.width].px;

  // Отступы, зазор и ширина контента на холсте; без значений — исходный вид секции
  function secApply(sec, node = secNode) {
    const s = node.style;
    s.padding = sec ? `${sec.pad.top}px ${sec.pad.right}px ${sec.pad.bottom}px ${sec.pad.left}px` : '';
    s.gap = sec ? sec.gap + 'px' : '';
    const w = sec && secContentWidth(sec);
    if (w) s.setProperty('--sec-content-w', w + 'px');
    else s.removeProperty('--sec-content-w');
  }

  function secDefaults() {
    secApply(null);
    const c = getComputedStyle(secNode);
    const pad = { split: false, top: parseInt(c.paddingTop, 10), right: parseInt(c.paddingRight, 10), bottom: parseInt(c.paddingBottom, 10), left: parseInt(c.paddingLeft, 10) };
    return { name: SEC_NAME, width: 'narrow', px: null, pad, gap: 0, fill: null };
  }

  function secRender() {
    const { pad, gap, width, px, fill } = secDraft;
    secRoot.querySelectorAll('[data-sec-axis]').forEach((n) => { n.hidden = pad.split; });
    secRoot.querySelector('[data-sec-sides]').hidden = !pad.split;
    secRoot.querySelector('[data-sec-pad-split]').classList.toggle('is-active', pad.split);
    secRoot.querySelectorAll('[data-sec-pad]').forEach((input) => {
      const key = input.dataset.secPad;
      input.value = key === 'h' ? pad.left : key === 'v' ? pad.top : pad[key];
    });
    secGap.value = gap;
    $('#secWidthName').textContent = SEC_WIDTHS[width].name;
    secWidthMenu.querySelectorAll('[data-width]').forEach((item) => {
      const on = item.dataset.width === width;
      item.classList.toggle('is-selected', on);
      item.setAttribute('aria-checked', on);
    });
    const preset = SEC_WIDTHS[width].px;
    secPx.value = px ?? '';
    secPx.placeholder = preset ? preset.toLocaleString('ru-RU') : '';
    secPx.disabled = !preset;
    secFillBtn.classList.toggle('is-none', !fill);
    if (fill) bgPaintBubble(secFillBtn, fill);
    else {
      secFillBtn.style.removeProperty('--pe-color');
      $('.pe__bubble-text', secFillBtn).textContent = '';
    }
  }

  function secCommit() {
    secDraft.name = secNameInput.value.trim() || SEC_NAME;
    const data = secData();
    data.section = secDraft;
    data.sectionFill = secDraft.fill;
  }

  function secMenuClose() {
    secWidthMenu.hidden = true;
    secWidth.setAttribute('aria-expanded', 'false');
  }

  function secClose() {
    if (secRoot.hidden) return;
    secMenuClose();
    secRoot.hidden = true;
    const btn = $('[data-sec-cmd="settings"]', secNode);
    btn.classList.remove('is-selected');
    btn.setAttribute('aria-pressed', 'false');
    secApply(secData().section);
    paintFill(secNode, secData().sectionFill, '', BG_DEFAULT);
  }

  const secEditor = PropertyEditor.mount(secRoot, {
    onDone: () => { secCommit(); secClose(); },
    onClose: secClose,
  });

  for (const node of SEC_NODES) $('[data-sec-cmd="settings"]', node).addEventListener('click', (e) => {
    if (!secRoot.hidden) { secClose(); return; }
    popupsClose();
    secNode = node;
    const saved = secData().section;
    secDraft = { ...(saved ? structuredClone(saved) : secDefaults()), fill: secData().sectionFill ?? null };
    secEditor.reset();
    if (secDraft.fill) secRoot.querySelector('[data-pe-chip="background"]').click(); // заданный фон — строкой, иначе чипса
    secNameInput.value = secDraft.name;
    secNameInput.dispatchEvent(new Event('input', { bubbles: true }));
    secRender();
    const r = stageRect(secNode);
    secRoot.hidden = false;
    peMoveTo(secRoot, r.left, r.top);
    e.currentTarget.classList.add('is-selected');
    e.currentTarget.setAttribute('aria-pressed', 'true');
  });

  // Новый ввод сразу виден на холсте; Enter и уход с поля показывают значение, которое применилось
  secRoot.addEventListener('input', (e) => {
    const t = e.target;
    const n = parseInt(t.value, 10);
    const valid = Number.isFinite(n);
    const { pad } = secDraft;
    const value = Math.min(Math.max(n, 0), 300);
    const side = t.dataset.secPad;
    if (side && valid) {
      if (side === 'h') pad.left = pad.right = value;
      else if (side === 'v') pad.top = pad.bottom = value;
      else pad[side] = value;
    } else if (t === secGap && valid) secDraft.gap = value;
    else if (t === secPx) secDraft.px = valid && n > 0 ? n : null;
    else return;
    secApply(secDraft);
  });
  secRoot.addEventListener('change', (e) => { if (e.target.closest('[data-sec-pad], #secGap, #secPx')) secRender(); });
  secRoot.addEventListener('click', (e) => {
    if (e.target.closest('.pe__reset')) { // свой сброс: PropertyEditor вернул бы значения на момент открытия
      e.stopPropagation();
      secDraft = secDefaults();
      secEditor.reset();
      secApply(secDraft);
      paintFill(secNode, null, '', BG_DEFAULT);
      secRender();
    } else if (e.target.closest('[data-sec-pad-split]')) {
      const { pad } = secDraft;
      pad.split = !pad.split;
      if (!pad.split) { // при сворачивании значения выравниваются по осям
        pad.right = pad.left;
        pad.bottom = pad.top;
      }
      secApply(secDraft);
      secRender();
    } else if (e.target.closest('#secFill')) bgFromSettings(secFillBtn);
    else if (e.target.closest('[data-pe-clear]')) { // строку убирает PropertyEditor, фон на холсте снимаем сами
      secDraft.fill = null;
      paintFill(secNode, null, '', BG_DEFAULT);
      secRender();
    }
  }, true);

  secWidth.addEventListener('click', () => {
    if (!secWidthMenu.hidden) { secMenuClose(); return; }
    const r = stageRect(secWidth);
    const box = stageRect(secWidth.closest('.pe__card'));
    secWidthMenu.hidden = false;
    secWidthMenu.style.left = Math.round(r.left - box.left - 16) + 'px';
    secWidthMenu.style.top = Math.round(r.top - box.top - 12) + 'px';
    secWidth.setAttribute('aria-expanded', 'true');
  });
  secWidthMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-width]');
    if (!item) return;
    secDraft.width = item.dataset.width;
    secDraft.px = null; // ширина из варианта заменяет введённую
    secMenuClose();
    secApply(secDraft);
    secRender();
  });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#secWidthMenu, #secWidth')) secMenuClose(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (secWidthMenu.hidden) secClose();
    else secMenuClose();
  });

  // ---------- Окно «Фон» (Figma 16385:63244, верхняя строка 16385:63266) — как в interface-prototype ----------
  // Фон секции: открывается из тулбара секции и из строки «Фон» её настроек. Из строки настроек встаёт вместо них, правки настроек при этом сохраняются. Правки фона сразу применяются к странице.
  // ✓ и ✕ этого окна только закрывают его, заготовленный цвет или градиент применяется и закрывает, картинка оставляет открытым.
  const BG_DEFAULT = '#f8f8f8';
  const BG_GRADS = ['#943253', '#f16767', '#e59545', '#e5cb45', '#009918', '#0c94ff', '#326194', '#4c3294', '#943288'];
  const BG_COLORS = ['#ffe3ec', '#ffe5e3', '#fff1e3', '#fffbe3', '#e3ffe8', '#e3faff', '#e3f1ff', '#eae3ff', '#ffe3fa', '#ededed'];
  const BG_IMGS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `assets/img/bg/0${n}.jpg`);
  const FX_DEFAULT = { op: 100, blur: 0, con: 100, sat: 100, temp: 0 };
  // Ползунки «Картинки»: диапазон и единица; 0 у контраста и насыщенности — серое / плоское, 100 — как в оригинале.
  const FX = [
    { key: 'op', name: 'Прозрачность', min: 0, max: 100, unit: '%' },
    { key: 'blur', name: 'Размытие', min: 0, max: 100, unit: '' },
    { key: 'con', name: 'Контраст', min: 0, max: 200, unit: '%' },
    { key: 'sat', name: 'Насыщенность', min: 0, max: 200, unit: '%' },
    { key: 'temp', name: 'Температура', min: -100, max: 100, unit: '' },
  ];
  const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const rgba = (hex, a) => `rgba(${hexRgb(hex).join(', ')}, ${a})`;
  const mixHex = (base, c, k) => {
    const b = hexRgb(base);
    return '#' + hexRgb(c).map((v, i) => Math.round(b[i] + (v - b[i]) * k).toString(16).padStart(2, '0')).join('');
  };
  const bgColorCss = (f) => (f.a >= 100 ? f.hex : rgba(f.hex, f.a / 100));
  const bgGradCss = (f, base = '') => `linear-gradient(${rgba(f.c, .1)}, rgba(248, 248, 248, 0) 27.546%)${base ? ', ' + base : ''}`;
  // Кружок в строке редактора и плашка в окне
  function bgPreview(f) {
    if (f.kind === 'img') return `url(${BG_IMGS[f.i]}) center / cover`;
    if (f.kind === 'grad') return `linear-gradient(${rgba(f.c, .1)}, rgba(248, 248, 248, 0)), ${BG_DEFAULT}`;
    return bgColorCss(f);
  }
  function bgPaintBubble(btn, f) {
    const alpha = f.kind === 'color' && f.a < 100;
    btn.style.setProperty('--pe-color', alpha ? f.hex : bgPreview(f));
    btn.style.setProperty('--pe-alpha', Math.max(alpha ? f.a : 0, 14) + '%');
    btn.querySelector('.pe__swatch').classList.toggle('pe__swatch--alpha', alpha);
    btn.querySelector('.pe__bubble-text').textContent = f.kind === 'img' ? 'Картинка'
      : f.kind === 'grad' ? `${mixHex(BG_DEFAULT, f.c, .1).toUpperCase()} → ${BG_DEFAULT.slice(1).toUpperCase()}`
      : f.hex.toUpperCase() + (alpha ? `, ${f.a / 100}` : '');
  }

  const bgWin = $('#bgWin');
  const bgHex = $('#bgHex');
  const bgAlpha = $('#bgAlpha');
  let bgKey = null; // что настраиваем: сейчас только фон секции, 'section'
  let bgAnchor = null; // команда тулбара, из которой открыто окно
  let bgSpot = null; // место окна, открытого из строки настроек: самой строки уже нет
  const BG_TOOLS = new Map(SEC_NODES.map((node) => [$('[data-sec-cmd="fill"]', node), 'section'])); // команды тулбаров и что они настраивают
  // У секции фон по умолчанию не задан
  const bgCur = () => secData().sectionFill ?? { kind: 'none' };

  $('#bgPresets').innerHTML =
    BG_GRADS.map((c) => `<button class="cw-sw is-grad" type="button" data-grad="${c}" style="--c:${rgba(c, .1)}" aria-label="Градиент"></button>`).join('') +
    [BG_DEFAULT, ...BG_COLORS].map((h) => `<button class="cw-sw" type="button" data-hex="${h}" style="--c:${h}" aria-label="${h}"></button>`).join('');
  $('#bgCat').innerHTML = BG_IMGS.map((src, i) =>
    `<button class="bg-tile" type="button" data-img="${i}" style="--img:url(${src})" aria-label="Картинка ${i + 1}"><span class="bg-tool"><span class="ico">&#xE660;</span></span></button>`).join('');
  $('#bgFx').innerHTML = FX.map((x) =>
    `<div class="bg-row" data-fx="${x.key}"><span class="bg-row__label">${x.name}</span>` +
    '<span class="bg-slider"><i class="bg-slider__fill"></i><i class="bg-slider__thumb"></i></span>' +
    `<span class="bg-num${x.unit ? '' : ' no-unit'}"><input type="text" inputmode="numeric" autocomplete="off" maxlength="4" aria-label="${x.name}"><span>${x.unit}</span></span></div>`).join('');

  function bgStore(f) {
    secData().sectionFill = f;
    paintFill(secNode, f, '', BG_DEFAULT);
  }
  function bgSet(f) {
    bgStore(f);
    bgRender(true);
  }
  function setFx(key, v, typed) {
    const f = bgCur();
    bgSet({ ...f, fx: { ...f.fx, [key]: v } });
    fxRender(typed ? key : null);
  }

  // fields — обновить и поля ввода (не нужно, пока пользователь печатает в одном из них)
  function bgRender(fields) {
    const f = bgCur();
    bgWin.dataset.kind = f.kind;
    const pill = $('#bgPill');
    pill.className = 'cw-pill' + (f.kind === 'img' ? ' is-img' : f.kind === 'none' ? ' is-none' : '');
    pill.style.setProperty('--c', f.kind === 'img' ? `url(${BG_IMGS[f.i]})` : f.kind === 'none' ? '#fff' : bgPreview(f));
    if (f.kind === 'grad') $('#bgGradFrom').textContent = mixHex(BG_DEFAULT, f.c, .1).slice(1).toUpperCase();
    if (fields && f.kind === 'color') { bgHex.value = f.hex.slice(1).toUpperCase(); bgAlpha.value = f.a; }
    if (fields && f.kind === 'none') { bgHex.value = ''; bgAlpha.value = 0; }
  }

  function fxRender(skipInput) {
    const f = bgCur().fx;
    for (const x of FX) {
      const row = $(`[data-fx="${x.key}"]`, bgWin);
      row.style.setProperty('--k', (f[x.key] - x.min) / (x.max - x.min));
      if (skipInput !== x.key) $('input', row).value = f[x.key];
    }
  }
  function openPic() {
    const f = bgCur();
    if (f.kind !== 'img') return;
    bgWin.classList.add('is-pic');
    $('#bgTitle').textContent = 'Картинка';
    $('#bgPicPv').style.setProperty('--img', `url(${BG_IMGS[f.i]})`);
    fxRender();
    bgPlace();
  }
  function closePic() {
    bgWin.classList.remove('is-pic');
    $('#bgTitle').textContent = 'Фон';
  }

  // Из тулбара окно встаёт под командой с зазором 4px, из строки настроек — поверх кружка, как палитра PropertyEditor. За сцену не выходит
  function bgPlace() {
    const r = bgAnchor && stageRect(bgAnchor);
    const { left, top } = bgAnchor ? { left: r.left, top: r.top + r.height + 4 } : bgSpot;
    bgWin.style.left = Math.max(8, Math.min(Math.round(left), stage.offsetWidth - bgWin.offsetWidth - 8)) + 'px';
    bgWin.style.top = Math.max(8, Math.min(Math.round(top), stage.offsetHeight - bgWin.offsetHeight - 8)) + 'px';
  }
  function bgToggle(anchor) {
    if (bgAnchor === anchor) { bgClose(); return; }
    popupsClose();
    bgAnchor = anchor;
    bgShow(BG_TOOLS.get(anchor));
  }
  function bgFromSettings(btn) {
    const r = stageRect(btn);
    secCommit();
    popupsClose();
    bgSpot = { left: r.left - 13, top: r.top - 13 };
    bgShow('section');
  }
  function bgShow(key) {
    bgKey = key;
    for (const btn of BG_TOOLS.keys()) {
      btn.classList.toggle('is-selected', btn === bgAnchor);
      btn.setAttribute('aria-pressed', btn === bgAnchor);
    }
    closePic();
    bgRender(true);
    bgWin.hidden = false;
    bgPlace();
  }
  function bgClose() {
    bgWin.hidden = true;
    bgKey = null;
    bgAnchor = null;
    for (const btn of BG_TOOLS.keys()) {
      btn.classList.remove('is-selected');
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  for (const node of SEC_NODES) {
    const btn = $('[data-sec-cmd="fill"]', node);
    btn.addEventListener('click', () => { secNode = node; bgToggle(btn); });
  }

  $('#bgDone').addEventListener('click', bgClose);
  $('#bgClose').addEventListener('click', bgClose);
  $('#bgBack').addEventListener('click', () => { closePic(); bgPlace(); });
  $('#bgPresets').addEventListener('click', (e) => {
    const sw = e.target.closest('.cw-sw');
    if (!sw) return;
    bgSet(sw.dataset.grad ? { kind: 'grad', c: sw.dataset.grad } : { kind: 'color', hex: sw.dataset.hex, a: 100 });
    bgClose();
  });
  // клик по картинке — поставить её (настройки сбрасываются для новой картинки); карандаш на картинке — ещё и открыть «Картинку»
  $('#bgCat').addEventListener('click', (e) => {
    const tile = e.target.closest('.bg-tile');
    if (!tile) return;
    const i = +tile.dataset.img;
    const f = bgCur();
    if (!(f.kind === 'img' && f.i === i)) bgSet({ kind: 'img', i, fx: { ...FX_DEFAULT } });
    if (e.target.closest('.bg-tool')) openPic();
  });
  bgHex.addEventListener('input', () => {
    const v = '#' + bgHex.value.trim().replace(/^#/, '');
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return;
    const hex = (v.length === 4 ? '#' + [...v.slice(1)].map((x) => x + x).join('') : v).toLowerCase();
    bgStore({ kind: 'color', hex, a: bgCur().a ?? 100 });
    bgRender(false);
  });
  bgAlpha.addEventListener('input', () => {
    bgAlpha.value = bgAlpha.value.replace(/\D/g, '');
    if (bgAlpha.value === '') return;
    const a = Math.min(100, +bgAlpha.value);
    const f = bgCur();
    if (f.kind === 'none') { // у незаданного фона цвет появляется вместе с прозрачностью
      if (a === 0) return;
      bgHex.value = 'FFFFFF';
    }
    bgStore({ kind: 'color', hex: f.hex ?? '#ffffff', a });
    bgRender(false);
  });
  for (const input of [bgHex, bgAlpha]) input.addEventListener('blur', () => { if (bgKey) bgRender(true); });

  // Ползунки: нажатие и перетаскивание; поле справа — ввод числа
  $('#bgFx').addEventListener('pointerdown', (e) => {
    const slider = e.target.closest('.bg-slider');
    if (!slider) return;
    const x = FX.find((f) => f.key === slider.parentNode.dataset.fx);
    const move = (ev) => {
      const r = slider.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const v = Math.round(x.min + k * (x.max - x.min));
      if (v !== bgCur().fx[x.key]) setFx(x.key, v);
    };
    slider.setPointerCapture(e.pointerId);
    move(e);
    slider.onpointermove = move;
    slider.onpointerup = slider.onpointercancel = () => { slider.onpointermove = slider.onpointerup = slider.onpointercancel = null; };
  });
  $('#bgFx').addEventListener('input', (e) => {
    const row = e.target.closest('[data-fx]');
    const x = FX.find((f) => f.key === row.dataset.fx);
    const input = e.target;
    input.value = input.value.replace(x.min < 0 ? /[^\d-]/g : /\D/g, '');
    if (!/^-?\d+$/.test(input.value)) return;
    setFx(x.key, Math.min(x.max, Math.max(x.min, +input.value)), true);
  });
  $('#bgFx').addEventListener('focusout', () => { if (bgKey && bgCur().kind === 'img') fxRender(); });

  rsRender();

  // ---------- Левый сайдбар (Figma rHabzni5OI5D4fxBLQdj2m 5:28393) ----------
  // Вписан в страницу или свёрнут в линии: по наведению на линии панель открывается поверх контента.
  // Режим запоминается между открытиями, страницы при обновлении возвращаются к исходным.
  const LS_KEY = 'dynamic-pages.sidebar';
  const lsRoot = $('#ls');
  const lsList = $('#lsList');
  const lsLines = $('#lsLines');
  const lsMenu = $('#lsMenu');
  const lsToggle = $('#lsToggle');
  // Сайт начинается с одной главной: остальные страницы приходят с компонентами
  const lsInitialPages = () => [{ id: 1, name: 'Главная', off: false, home: true }];
  let lsPages = lsInitialPages();
  let lsActive = 1;
  let lsNextId = 2;
  let lsMenuPage = null; // страница, у которой открыто меню «⋮»
  let lsEditing = null;  // { page, row, input } — идёт переименование
  let lsCloseTimer = 0;

  const lsPage = (id) => lsPages.find((p) => p.id === id);
  const lsVisibleCount = () => lsPages.filter((p) => !p.off).length;

  function lsReadCollapsed() {
    try { return localStorage.getItem(LS_KEY) === 'collapsed'; } catch { return false; }
  }

  function lsSetCollapsed(collapsed) {
    stage.classList.toggle('is-ls-collapsed', collapsed);
    stage.classList.remove('is-ls-open');
    $('#lsToggleIco').innerHTML = collapsed ? '&#xEBFB;' : '&#xEBFA;';
    lsToggle.setAttribute('aria-label', collapsed ? 'Закрепить панель' : 'Свернуть панель');
    try { localStorage.setItem(LS_KEY, collapsed ? 'collapsed' : 'pinned'); } catch {}
  }

  // Порядок показа: сначала страницы сайта, потом страницы компонентов группами — в порядке компонентов, как в «Параметрах сайта»
  function lsOrdered() {
    const own = lsPages.filter((p) => !p.comp);
    return [own, ...Object.keys(COMP).map((id) => lsPages.filter((p) => p.comp === id))];
  }
  function lsRenderLines() {
    lsLines.replaceChildren(...lsOrdered().flat().map((p) => el('span', 'ls-line' + (p.id === lsActive ? ' is-active' : ''))));
  }

  function lsRow(p) {
    const row = el('div', 'ls-item' + (p.id === lsActive ? ' is-active' : '') + (p.off ? ' is-off' : ''),
      '<span class="ls-item__marker"></span><span class="ls-item__name"></span>' +
      '<span class="ls-item__cmds">' +
      '<button class="btn btn--link btn--style-label btn--size-m btn--icon ls-cmd" type="button" data-cmd="more" aria-label="Ещё"><span class="btn__icon">&#xE9D9;</span></button>' +
      '</span>');
    row.dataset.id = p.id;
    row.querySelector('.ls-item__name').textContent = p.name;
    if (p.productPage) row.querySelector('.ls-item__cmds').remove(); // страницу карточки товара удалить нельзя: меню «Ещё» ей не нужно
    return row;
  }
  const LS_GROUP_EXPANDER = false; // экспандер групп пока скрыт: true вернёт стрелку и сворачивание
  const lsCollapsed = new Set(); // id компонентов со свёрнутой группой
  // Группа компонента: заголовок — маленькая иконка компонента и его название, под ним — страницы, которые он принёс
  function lsGroupHead(id) {
    const head = el('div', 'ls-group' + (lsCollapsed.has(id) ? ' is-collapsed' : ''));
    const icon = el('img', 'ls-group__icon');
    icon.src = `assets/img/comp/${id}.svg`;
    icon.width = icon.height = 24;
    icon.alt = '';
    const name = el('span', 'ls-group__name');
    name.textContent = COMP[id].name;
    // Экспандер — та же стрелка, что у полей в «Данных». Только прячет строки: страница и список не перерисовываются
    head.append(icon, name);
    if (!LS_GROUP_EXPANDER) return head;
    head.classList.add('has-expander');
    head.append(el('span', 'ico rs-field__arrow', '&#xEB89;'));
    head.addEventListener('click', () => {
      const collapsed = head.classList.toggle('is-collapsed');
      if (collapsed) lsCollapsed.add(id); else lsCollapsed.delete(id);
      for (let row = head.nextElementSibling; row && row.classList.contains('ls-item'); row = row.nextElementSibling) row.hidden = collapsed;
    });
    return head;
  }
  function lsRender() {
    const [own, ...groups] = lsOrdered();
    // Страницы компонентов — общим списком после своих, без заголовка группы компонента
    lsList.classList.remove('has-groups');
    lsList.replaceChildren(...own.map(lsRow), ...groups.flat().map(lsRow));
    lsRenderLines();
    siteShowPage(lsPage(lsActive));
    siteProductSyncShop();
  }

  // Выбор только переставляет классы: строки остаются на месте, иначе двойной клик не дойдёт до строки.
  function lsSelect(id) {
    if (id !== lsActive) salesClose(); // окно точек продаж относится к открытой странице: при переходе на другую закрывается
    lsActive = id;
    for (const row of lsList.children) {
      row.classList.toggle('is-active', Number(row.dataset.id) === id);
    }
    lsRenderLines();
    siteShowPage(lsPage(id));
  }

  function lsCloseMenu() {
    if (lsMenuPage == null) return;
    lsMenu.hidden = true;
    lsList.querySelector('.is-menu')?.classList.remove('is-menu');
    lsMenuPage = null;
    lsCollapseIfLeft();
  }

  function lsOpenMenu(id, btn) {
    popupsClose();
    lsMenuPage = id;
    btn.closest('.ls-item').classList.add('is-menu');
    // Страница компонента принадлежит ему: её нельзя сделать главной, скрыть, дублировать и удалить — удаляет только сам компонент
    const comp = !!lsPage(id).comp;
    for (const act of ['home', 'duplicate', 'hide', 'delete']) $(`[data-act="${act}"]`, lsMenu).hidden = comp;
    // Единственную свою страницу удалить нельзя: у сайта должна остаться хотя бы одна
    if (lsPages.filter((p) => !p.comp).length === 1) $('[data-act="delete"]', lsMenu).hidden = true;
    lsMenu.hidden = false;
    const r = stageRect(btn);
    lsMenu.style.left = Math.round(r.left + r.width / 2 + 26 - lsMenu.offsetWidth) + 'px'; // центр крестика — на центре «⋮»: 26 от правого края меню, 24 от верхнего
    lsMenu.style.top = Math.round(r.top + r.height / 2 - 24) + 'px';
  }

  function lsStartRename(id) {
    lsFinishRename(true);
    lsSelect(id);
    const page = lsPage(id);
    const row = lsList.querySelector(`[data-id="${id}"]`);
    const input = el('input', 'ls-input');
    input.value = page.name;
    input.setAttribute('aria-label', 'Название страницы');
    const save = el('span', 'ls-save',
      '<button class="btn btn--filled btn--style-pale btn--size-m btn--icon ls-cmd ls-save__ok" type="button" data-save="ok" aria-label="Сохранить"><span class="btn__icon">&#xE75E;</span></button>' +
      '<button class="btn btn--ghost btn--style-label btn--size-m btn--icon ls-cmd ls-cmd--24" type="button" data-save="cancel" aria-label="Отменить"><span class="btn__icon">&#xE66C;</span></button>');
    row.classList.add('is-edit');
    row.querySelector('.ls-item__name').replaceWith(input);
    input.after(save); // у карточки товара нет блока команд — кнопки сохранения встают сразу за полем
    lsEditing = { page, row, input };
    input.focus();
    input.select();
  }

  // apply — сохранить название; пустое название не сохраняется.
  function lsFinishRename(apply) {
    if (!lsEditing) return;
    const { page, input } = lsEditing;
    lsEditing = null;
    const name = input.value.trim();
    if (apply && name) page.name = name;
    lsRender();
    lsCollapseIfLeft();
  }

  // Удаление: фокус — на предыдущую. Удалена последняя — создаётся пустая страница.
  function lsDelete(id) {
    const at = lsPages.findIndex((p) => p.id === id);
    lsPages.splice(at, 1);
    if (!lsPages.length) lsPages.push({ id: lsNextId++, name: 'Страница 1', off: false, blank: true, mode: 'page' });
    if (id === lsActive) lsActive = lsPages[Math.max(0, at - 1)].id;
    if (!lsVisibleCount()) lsPage(lsActive).off = false; // хотя бы одна страница остаётся видимой
    lsRender();
  }

  // Копия встаёт под исходную и сразу открывается. Адрес не копируем: он у каждой страницы свой.
  function lsDuplicate(id) {
    const at = lsPages.findIndex((p) => p.id === id);
    const page = { ...lsPages[at], id: lsNextId++, name: lsPages[at].name + ' (копия)', addr: '' };
    lsPages.splice(at + 1, 0, page);
    lsActive = page.id;
    lsRender();
  }

  // Панель поверх контента закрывается, когда мышь ушла, а меню и переименование закрыты.
  function lsCollapseIfLeft() {
    clearTimeout(lsCloseTimer);
    if (!stage.classList.contains('is-ls-open') || lsRoot.matches(':hover')) return;
    lsCloseTimer = setTimeout(() => {
      if (lsMenuPage == null && !lsEditing && lsNew.hidden && !lsRoot.matches(':hover')) stage.classList.remove('is-ls-open');
    }, 200);
  }

  lsLines.addEventListener('mouseenter', () => {
    clearTimeout(lsCloseTimer);
    stage.classList.add('is-ls-open');
  });
  lsRoot.addEventListener('mouseenter', () => clearTimeout(lsCloseTimer));
  lsRoot.addEventListener('mouseleave', lsCollapseIfLeft);
  lsToggle.addEventListener('click', () => lsSetCollapsed(!stage.classList.contains('is-ls-collapsed')));

  lsList.addEventListener('click', (e) => {
    const row = e.target.closest('.ls-item');
    if (!row) return;
    const id = Number(row.dataset.id);
    const save = e.target.closest('[data-save]');
    if (save) { lsFinishRename(save.dataset.save === 'ok'); return; }
    if (row.classList.contains('is-edit')) return;
    const cmd = e.target.closest('[data-cmd]');
    if (cmd?.dataset.cmd === 'more') {
      if (lsMenuPage === id) lsCloseMenu();
      else lsOpenMenu(id, cmd);
    } else {
      lsSelect(id);
    }
  });
  lsList.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.ls-item');
    if (row && !e.target.closest('[data-cmd], [data-save]') && !row.classList.contains('is-edit')) lsStartRename(Number(row.dataset.id));
  });
  lsList.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lsFinishRename(true);
    else if (e.key === 'Escape') lsFinishRename(false);
  });

  lsMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-act]');
    if (!item) return;
    const id = lsMenuPage;
    const at = stageRect(lsMenu);
    lsCloseMenu();
    // «Сделать главной», «Скопировать ссылку» и «Скрыть» пока только закрывают меню
    if (item.dataset.act === 'settings') lsPageSettings(id, at);
    else if (item.dataset.act === 'duplicate') lsDuplicate(id);
    else if (item.dataset.act === 'delete') lsDelete(id);
  });
  $('#lsMenuClose').addEventListener('click', lsCloseMenu);

  // Окно новой страницы: открывается поверх плюса. Адрес и SEO-заголовок идут за названием, пока их не меняли вручную.
  // «Сохранить» и Enter в названии добавляют страницу и открывают её, крестик и Esc закрывают без добавления. Клик мимо окно не закрывает.
  // Это же окно — настройки страницы: открывается из меню «⋮» с её значениями, «Сохранить» применяет их к ней.
  const lsNew = $('#lsNew');
  peDraggable(lsNew);
  const lsNewName = $('#lsNewName');
  const lsNewAddr = $('#lsNewAddr');
  const lsNewSeoTitle = $('#lsNewSeoTitle');
  const lsNewSeoDescription = $('#lsNewSeoDescription');
  const lsSeoDescriptionAdd = $('#lsSeoDescriptionAdd');
  const lsSeoDescriptionField = $('#lsSeoDescriptionField');
  const lsNewIndex = $('#lsNewIndex');
  const LS_NEW_NAME = 'Новая страница';
  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  const lsSlug = (name) => [...name.trim().toLowerCase()].map((c) => TRANSLIT[c] ?? c).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  let lsNewSeoEdited = false;
  let lsNewPage = null; // настраиваемая страница, null — новая

  function lsNewSync() {
    const name = lsNewName.value.trim() || LS_NEW_NAME;
    lsNewAddr.placeholder = lsSlug(name);
    if (!lsNewSeoEdited) lsNewSeoTitle.value = name;
  }

  function lsNewFill(page) {
    lsNewPage = page;
    lsNew.setAttribute('aria-label', page ? 'Настройки страницы' : 'Новая страница');
    lsNewAddr.value = page?.addr ?? '';
    lsNewSeoEdited = page?.seo != null;
    lsNewIndex.querySelector('.rp-switch').classList.toggle('is-on', !!page?.noindex);
    lsNewIndex.setAttribute('aria-checked', !!page?.noindex);
    lsAccessClose();
    lsAccessSelect(lsAccessMenu.querySelector(`[data-access="${page?.access ?? 'public'}"]`));
    lsNewSeoDescription.value = page?.seoDescription ?? '';
    lsDescriptionShow(page?.seoDescription != null);
    lsNewEditor.reset(); // пустое название, SEO убран; вызывает lsNewSync
    if (!page) return;
    lsNewName.value = page.name;
    if (page.seo != null) {
      lsNew.querySelector('[data-pe-chip="seo"]').click();
      lsNewSeoTitle.value = page.seo;
    }
    lsNewName.dispatchEvent(new Event('input', { bubbles: true })); // PropertyEditor и подсказка адреса узнают название
  }

  function lsNewShow(left, top) {
    popupsClose();
    lsNew.hidden = false;
    lsNew.style.left = Math.round(left) + 'px';
    lsNew.style.top = Math.round(top) + 'px';
    lsNewName.focus();
  }

  function lsNewOpen() {
    lsNewFill(null);
    const r = stageRect($('#lsAdd'));
    lsNewShow(r.left - 12, r.top + r.height / 2 - 22);
  }

  // Настройки страницы открываются на месте меню «⋮»
  function lsPageSettings(id, at) {
    lsNewFill(lsPage(id));
    lsNewShow(at.left, at.top);
  }

  function lsNewClose() {
    if (lsNew.hidden) return;
    lsAccessClose();
    lsNew.hidden = true;
    lsCollapseIfLeft();
  }

  function lsNewSave() {
    const fields = {
      name: lsNewName.value.trim() || LS_NEW_NAME,
      addr: lsNewAddr.value.trim(),
      noindex: lsNewIndex.querySelector('.rp-switch').classList.contains('is-on'),
      seo: lsNew.querySelector('[data-pe-row="seo"]').hidden ? null : lsNewSeoTitle.value,
      seoDescription: lsNew.querySelector('[data-pe-row="seo"]').hidden || lsSeoDescriptionField.hidden ? null : lsNewSeoDescription.value,
      access: lsAccessMenu.querySelector('.is-selected').dataset.access,
      mode: 'page',
    };
    if (lsNewPage) {
      Object.assign(lsNewPage, fields);
    } else {
      const page = { id: lsNextId++, off: false, blank: true, ...fields };
      lsPages.push(page);
      lsActive = page.id;
    }
    lsRender();
    lsNewClose();
  }

  // Доступ — настройка прототипа; здесь задаётся состояние страницы, серверной авторизации нет.
  const lsAccess = $('#lsAccess');
  const lsAccessMenu = $('#lsAccessMenu');
  function lsAccessSelect(item) {
    lsAccessMenu.querySelectorAll('[data-access]').forEach((option) => {
      const selected = option === item;
      option.classList.toggle('is-selected', selected);
      option.setAttribute('aria-checked', selected);
    });
    lsAccess.textContent = item.textContent;
  }
  function lsAccessClose() {
    lsAccessMenu.hidden = true;
    lsAccess.setAttribute('aria-expanded', 'false');
  }
  lsAccess.addEventListener('click', () => {
    if (!lsAccessMenu.hidden) { lsAccessClose(); return; }
    const r = stageRect(lsAccess);
    const box = stageRect(lsNew);
    lsAccessMenu.style.left = Math.round(r.left - box.left - 30) + 'px';
    lsAccessMenu.style.top = Math.round(r.top + r.height / 2 - box.top - 22) + 'px';
    lsAccessMenu.hidden = false;
    lsAccess.setAttribute('aria-expanded', 'true');
  });
  lsAccessMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-access]');
    if (item) lsAccessSelect(item);
    if (item || e.target.closest('#lsAccessClose')) { lsAccessClose(); lsAccess.focus(); }
  });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#lsAccessMenu, #lsAccess')) lsAccessClose(); });

  // «Страница товара» в «Параметрах сайта»: одна страница на сайте — встаёт по клику сразу, несколько — радиоменю со страницами (как «Доступ»)
  const productPagePick = $('#productPagePick');
  const productPageMenu = $('#productPageMenu');
  let productPageId = null;
  function productPageRender() {
    if (productPageId != null && !lsPage(productPageId)) productPageId = null; // выбранную страницу удалили
    productPagePick.textContent = lsPage(productPageId)?.name ?? 'Выберите страницу';
  }
  function productPageSet(id) {
    productPageId = id;
    productPageRender();
  }
  function productPageClose() {
    productPageMenu.hidden = true;
    productPagePick.setAttribute('aria-expanded', 'false');
  }
  productPagePick.addEventListener('click', () => {
    if (!productPageMenu.hidden) { productPageClose(); return; }
    if (lsPages.length === 1) { productPageSet(lsPages[0].id); return; }
    const list = $('.mw-menu__list', productPageMenu);
    list.replaceChildren(...lsPages.map((page) => {
      const on = page.id === productPageId;
      const item = el('button', 'mw-menu__item ls-mode__item' + (on ? ' is-selected' : ''), '<span class="ls-mode__toggle"></span><span class="mw-menu__text"></span>');
      item.type = 'button';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', on);
      item.dataset.pageId = page.id;
      $('.mw-menu__text', item).textContent = page.name;
      return item;
    }));
    // первый пункт — на уровне ссылки, маркер левее текста, как у «Доступа»
    const r = stageRect(productPagePick);
    const box = stageRect(rsParams);
    productPageMenu.style.left = Math.round(r.left - box.left - 30) + 'px';
    productPageMenu.style.top = Math.round(r.top + r.height / 2 - box.top - 22) + 'px';
    productPageMenu.hidden = false;
    productPagePick.setAttribute('aria-expanded', 'true');
  });
  productPageMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-page-id]');
    if (item) productPageSet(Number(item.dataset.pageId));
    if (item || e.target.closest('#productPageClose')) { productPageClose(); productPagePick.focus(); }
  });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#productPageMenu, #productPagePick')) productPageClose(); });

  function lsDescriptionShow(show) {
    lsSeoDescriptionField.hidden = !show;
    lsSeoDescriptionAdd.hidden = show;
    lsSeoDescriptionAdd.setAttribute('aria-expanded', show);
  }
  lsSeoDescriptionAdd.addEventListener('click', () => {
    lsDescriptionShow(true);
    lsNewSeoDescription.focus();
  });
  lsNew.addEventListener('click', (e) => {
    if (e.target.closest('[data-pe-clear], .pe__reset')) {
      lsNewSeoDescription.value = '';
      lsDescriptionShow(false);
    }
    if (e.target.closest('.pe__reset')) {
      lsAccessClose();
      lsAccessSelect(lsAccessMenu.querySelector('[data-access="public"]'));
    }
  });

  // Чипс и крестик SEO, название и кнопки шапки — PropertyEditor из ui-kit
  const lsNewEditor = PropertyEditor.mount(lsNew, { onChange: lsNewSync, onDone: lsNewSave, onClose: lsNewClose });

  $('#lsAdd').addEventListener('click', lsNewOpen);
  // пустое название показываем как имя по умолчанию, при возврате в поле его можно сразу перепечатать
  lsNewName.addEventListener('blur', () => { if (!lsNewName.value.trim()) lsNewName.value = LS_NEW_NAME; });
  lsNewName.addEventListener('focus', () => { if (lsNewName.value === LS_NEW_NAME) lsNewName.select(); });
  lsNewName.addEventListener('keydown', (e) => { if (e.key === 'Enter') lsNewSave(); });
  lsNewSeoTitle.addEventListener('input', () => { lsNewSeoEdited = true; });
  lsNewIndex.addEventListener('click', () => {
    const on = lsNewIndex.querySelector('.rp-switch').classList.toggle('is-on');
    lsNewIndex.setAttribute('aria-checked', on);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!lsAccessMenu.hidden) { lsAccessClose(); lsAccess.focus(); }
    else lsNewClose();
  });

  // Клик мимо окна настроек страницы закрывает его без сохранения, как крестик. «+» и меню «⋮» окно открывают сами
  document.addEventListener('mousedown', (e) => {
    if (!lsNew.hidden && !e.target.closest('#lsNew, #lsAdd, #lsMenu, #confirm')) lsNewClose();
  });

  // Клик мимо закрывает меню и сохраняет название.
  stage.addEventListener('mousedown', (e) => {
    if (lsMenuPage != null && !e.target.closest('#lsMenu, [data-cmd="more"]')) lsCloseMenu();
    if (lsEditing && !lsEditing.row.contains(e.target)) lsFinishRename(true);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lsCloseMenu(); });

  // Типовое заполнение: сайт уже собран — «Главная», «Меню» с каталогом, «Профиль» с виджетом покупателя, «Карточка товара» с карточкой.
  // Это свои страницы сайта, а не страницы компонента. «Ресторан» подключён с двумя точками продаж, страница товара — «Карточка товара»
  function scenTypicalPages() {
    const page = (name, extra) => ({ id: lsNextId++, name, off: false, mode: 'page', ...extra });
    return [
      ...lsInitialPages(),
      page('Меню'),
      page('Профиль', { blank: true, compWidget: 'Профиль покупателя' }),
      page('Карточка товара', { blank: true, product: true, productPage: true }), // productPage — страницу и её виджет «Товар» удалить нельзя
    ];
  }

  // Сценарии панели — состояния сайта. «Добавление каталога» — у сайта только главная, ни одного компонента;
  // «Типовое заполнение» — заполненный сайт с подключённым «Рестораном» (scenTypicalPages).
  function scenApply(scenario) {
    popupsClose();
    lsNewClose();
    lsCloseMenu();
    lsFinishRename(false);
    lsPages = lsInitialPages();
    lsActive = 1;
    productPageId = null;
    compOn.clear();
    compRoots.clear();
    catalogHomeSet(true);
    catalogMenu = false;
    const typical = scenario === 'typical';
    catalogAdded = typical;
    if (typical) {
      // компонент подключён без своих страниц: их роль играют страницы сайта, каталог стоит на «Меню»
      compOn.add('restaurant');
      compRoots.add('restaurant');
      catalogHomeSet(false);
      lsPages = scenTypicalPages();
      productPageId = lsPages.find((p) => p.product).id;
    }
    salesSaved = catalogAdded ? ROOT_SALES.slice(0, 2).map((point) => ({ id: point.id, price: point.price })) : [];
    shopCatalogPin.hidden = catalogAdded;
    siteCatalogShow(catalogAdded);
    salesRender();
    siteShown = null; // главная открывается заново: выделение и секции из прошлого сценария не переносятся
    lsRender();
  }

  lsSetCollapsed(lsReadCollapsed());
  scenApply(stage.dataset.scenario);
})();
