window.createCharCard = function (key, value) {
  const card = document.createElement('div');
  card.className = 'flex items-center bg-gray-50 p-2 rounded border mt-2 gap-2';

  const span = document.createElement('span');
  span.className = 'flex-1';

  const strong = document.createElement('strong');
  strong.textContent = key;
  span.appendChild(strong);
  span.append(`: ${value}`); // это безопасно

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'text-blue-600 hover:text-blue-800 text-sm edit-char';
  editBtn.innerHTML = '<i data-lucide="pencil" class="w-4 h-4"></i>';
  editBtn.title = 'Редактировать';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'text-red-600 hover:text-red-800 text-sm delete-char';
  deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
  deleteBtn.title = 'Удалить';

  // Удаление
  deleteBtn.addEventListener('click', () => {
    charList.removeChild(card);
    updateCharJSON();
  });

  // Редактирование
  editBtn.addEventListener('click', () => {
    card.innerHTML = '';

    const inputKey = document.createElement('input');
    inputKey.type = 'text';
    inputKey.value = key;
    inputKey.className = 'border border-gray-300 px-3 py-1 text-sm w-1/3 mr-2';

    const inputValue = document.createElement('input');
    inputValue.type = 'text';
    inputValue.value = value;
    inputValue.className = 'border border-gray-300 px-3 py-1 text-sm w-1/3 mr-2';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'text-green-600 hover:text-green-800 text-sm save-char';
    saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
    saveBtn.title = 'Сохранить';

    card.appendChild(inputKey);
    card.appendChild(inputValue);
    card.appendChild(saveBtn);

    lucide.createIcons();

    saveBtn.addEventListener('click', () => {
      const newKey = inputKey.value.trim();
      const newValue = inputValue.value.trim();
      if (newKey && newValue) {
        const updatedCard = createCharCard(newKey, newValue);
        card.replaceWith(updatedCard);
        updateCharJSON();
      }
    });
  });

  card.appendChild(span);
  card.appendChild(editBtn);
  card.appendChild(deleteBtn);
  lucide.createIcons();
  return card;
};

// ==== Обновление JSON ====
window.updateCharJSON = function () {
  const chars = [];
  Array.from(charList.children).forEach(card => {
    const span = card.querySelector('span');
    if (!span) return;
    // Чтение key и value без split
    const strong = span.querySelector('strong');
    if (!strong) return;
    const key = strong.textContent.trim();
    // value — всё, что после strong (узлы типа text)
    let value = '';
    for (let node of span.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        value += node.textContent;
      }
    }
    value = value.replace(/^:\s*/, '').trim();
    if (key && value) {
      chars.push({ key, value });
    }
  });
  charJSON.value = JSON.stringify(chars);
};
