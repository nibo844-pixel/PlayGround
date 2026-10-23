(function () {
  'use strict';

  const shell = document.getElementById('shell');
  const scrim = document.getElementById('scrim');
  const chatScroll = document.getElementById('chatScroll');
  const composer = document.getElementById('composer');
  const input = document.getElementById('promptInput');
  const typing = document.getElementById('typing');
  const toastEl = document.getElementById('toast');
  const railState = document.getElementById('railState');
  const liveTitle = document.getElementById('liveTitle');
  const liveSub = document.getElementById('liveSub');
  const liveSteps = document.getElementById('liveSteps');
  const liveProgress = document.querySelector('.live-progress span');
  let toastTimer = null;
  let agentBusy = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ico');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function showToast(message) {
    if (!message) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  function closeNav() {
    shell.classList.remove('nav-open');
    document.getElementById('menuButton').setAttribute('aria-expanded', 'false');
  }

  function scrollToLatest(behavior) {
    requestAnimationFrame(() => {
      chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: behavior || 'smooth' });
    });
  }

  function currentTime() {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function agentAvatar(className) {
    const avatar = element('span', 'avatar avatar-orb small ' + (className || ''));
    avatar.setAttribute('aria-hidden', 'true');
    avatar.appendChild(element('span'));
    return avatar;
  }

  function addMeta(bubble, label, time) {
    const meta = element('div', 'bubble-meta');
    meta.appendChild(element('span', 'eyebrow', label));
    meta.appendChild(element('time', '', time || currentTime()));
    bubble.appendChild(meta);
  }

  function addRunCard(bubble, data) {
    const card = element('div', 'run-card');
    const head = element('div', 'run-head');
    const runIcon = element('span', 'run-icon');
    runIcon.appendChild(icon('check'));
    const copy = element('div');
    copy.appendChild(element('strong', '', data.title));
    copy.appendChild(element('small', '', data.subtitle));
    head.appendChild(runIcon);
    head.appendChild(copy);
    head.appendChild(element('span', 'pill success', data.status || 'Done'));
    card.appendChild(head);

    const list = element('ul', 'run-list');
    (data.rows || []).forEach(function (row) {
      const item = element('li');
      const tick = element('span', 'tick');
      tick.appendChild(icon('check'));
      const body = element('span');
      body.appendChild(document.createTextNode(row[0]));
      if (row[1]) body.appendChild(element('small', '', row[1]));
      item.appendChild(tick);
      item.appendChild(body);
      list.appendChild(item);
    });
    card.appendChild(list);

    const actions = element('div', 'run-actions');
    const plan = element('button', 'ghost-btn', 'View plan');
    plan.type = 'button';
    plan.appendChild(icon('pulse'));
    const undo = element('button', 'ghost-btn', 'Undo');
    undo.type = 'button';
    undo.appendChild(icon('undo'));
    actions.appendChild(plan);
    actions.appendChild(undo);
    card.appendChild(actions);
    bubble.appendChild(card);

    plan.addEventListener('click', () => showToast('Plan opened: ' + (data.rows || []).length + ' steps, all complete.'));
    undo.addEventListener('click', () => showToast('Nothing to undo. This one is handled.'));
  }

  function addApproval(bubble, data) {
    const card = element('div', 'approval-card');
    const holder = element('span', 'approval-icon');
    holder.appendChild(icon(data.icon || 'car'));
    const copy = element('div', 'approval-copy');
    const top = element('div', 'approval-top');
    top.appendChild(element('strong', '', data.title));
    top.appendChild(element('span', 'price', data.price));
    copy.appendChild(top);
    copy.appendChild(element('small', '', data.meta));
    const button = element('button', 'approve-btn', data.action);
    button.type = 'button';
    const note = element('p', 'hold-note', data.note);
    card.appendChild(holder);
    card.appendChild(copy);
    card.appendChild(button);
    card.appendChild(note);
    bubble.appendChild(card);

    button.addEventListener('click', function () {
      if (button.classList.contains('approved')) return;
      button.classList.add('approved');
      button.textContent = data.confirmedLabel || 'Confirmed';
      card.classList.add('approved');
      note.textContent = data.confirmedNote || 'Confirmed. Mira will keep you posted.';
      showToast(data.confirmedToast || 'Confirmed. Mira is on it.');
    });
  }

  function addUserMessage(text) {
    const article = element('article', 'msg user-msg');
    const body = element('div', 'msg-body');
    const bubble = element('div', 'bubble user-bubble');
    addMeta(bubble, 'You');
    bubble.appendChild(element('p', '', text));
    body.appendChild(bubble);
    article.appendChild(body);
    const avatar = element('span', 'avatar avatar-photo small', 'AR');
    avatar.setAttribute('aria-hidden', 'true');
    article.appendChild(avatar);
    chatScroll.insertBefore(article, typing);
    scrollToLatest();
  }

  function addAgentMessage(data) {
    const article = element('article', 'msg agent-msg');
    article.appendChild(agentAvatar());
    const body = element('div', 'msg-body');
    const bubble = element('div', 'bubble agent-bubble');
    addMeta(bubble, data.eyebrow || 'Mira', data.time);
    bubble.appendChild(element('p', '', data.lead));
    if (data.card) addRunCard(bubble, data.card);
    if (data.approval) addApproval(bubble, data.approval);
    body.appendChild(bubble);

    if (data.followups && data.followups.length) {
      const chips = element('div', 'quick-chips');
      data.followups.forEach(function (prompt) {
        const chip = element('button', '', prompt);
        chip.type = 'button';
        chip.dataset.prompt = prompt;
        chips.appendChild(chip);
      });
      body.appendChild(chips);
    }

    article.appendChild(body);
    chatScroll.insertBefore(article, typing);
    scrollToLatest();
  }

  function updateLive(data) {
    if (!data.live) return;
    liveTitle.textContent = data.live.title;
    liveSub.textContent = data.live.subtitle || 'Working through the details.';
    railState.textContent = 'Running';
    liveSteps.replaceChildren();
    (data.live.steps || []).forEach(function (step, index, all) {
      const item = element('li', index === all.length - 1 ? 'active' : 'done');
      const marker = element('span');
      if (index !== all.length - 1) marker.appendChild(icon('check'));
      item.appendChild(marker);
      item.appendChild(document.createTextNode(step));
      liveSteps.appendChild(item);
    });
    if (liveProgress) liveProgress.style.width = '62%';
    setTimeout(function () {
      if (!liveSteps.lastElementChild) return;
      const last = liveSteps.lastElementChild;
      last.classList.remove('active');
      last.classList.add('done');
      const marker = last.firstElementChild;
      marker.replaceChildren(icon('check'));
      railState.textContent = 'Complete';
      if (liveProgress) liveProgress.style.width = '100%';
      liveSub.textContent = data.live.done || 'All set. Nothing else needs you.';
    }, 1800);
  }

  function responseFor(text) {
    const lower = text.toLowerCase();
    if (/(coffee|flat white|latte|espresso|cappuccino)/.test(lower)) {
      return {
        eyebrow: 'Handled',
        lead: 'Done — your flat white is waiting at Fábrica. I picked the pickup window that fits your walk from the office.',
        card: {
          title: 'Coffee pickup',
          subtitle: 'Fábrica · 4 min walk',
          status: 'Ordered',
          rows: [
            ['Flat white · oat milk', 'Ready at 9:10 AM'],
            ['Paid with Wallet', '$4.20 · receipt saved'],
            ['Route added', 'Leave at 9:02 AM']
          ]
        },
        followups: ['Add a pastry', 'Change pickup time', 'Send receipt to Sam'],
        live: {
          title: 'Coffee pickup',
          subtitle: 'Order placed. Watching the queue.',
          steps: ['Checked your usual order', 'Found the shortest queue', 'Order placed for 9:10 AM'],
          done: 'Order confirmed. Walk over whenever you are ready.'
        }
      };
    }
    if (/(airport|ride|car|taxi|transfer|flight)/.test(lower)) {
      return {
        eyebrow: 'On it',
        lead: 'I have a black car holding for you at 4:10 PM. Traffic on the bridge is clearing, so you will reach departures with 50 minutes to spare.',
        card: {
          title: 'Airport transfer',
          subtitle: 'Today · 4:10 PM · 18 min',
          status: 'Held',
          rows: [
            ['Driver assigned', 'Miguel · 4.9 rating'],
            ['Pickup', 'Rua da Boavista 12'],
            ['Arrive at airport', '4:28 PM · Terminal 1']
          ]
        },
        approval: {
          title: 'Confirm the ride',
          price: '$24',
          meta: 'Black car · free cancellation for 5 min',
          action: 'Confirm ride',
          note: 'Mira will release the car at 4:15 PM if you do not confirm.',
          confirmedLabel: 'Ride confirmed',
          confirmedNote: 'Confirmed. Miguel is on his way at 4:10 PM.',
          confirmedToast: 'Ride confirmed. Your driver details are in Wallet.'
        },
        followups: ['Add a coffee stop', 'Ask Miguel to wait', 'Move pickup to 4:20'],
        live: {
          title: 'Airport transfer',
          subtitle: 'Holding a black car for you.',
          steps: ['Checked traffic on the bridge', 'Compared 3 car options', 'Held a black car for 4:10 PM'],
          done: 'Car held. Confirm when you are ready.'
        }
      };
    }
    if (/(dinner|table|restaurant|sam|reservation)/.test(lower)) {
      return {
        eyebrow: 'Booked',
        lead: 'Nóma is confirmed for 7:30 PM. I kept the window seat and moved your last call so you can leave with time to spare.',
        card: {
          title: 'Dinner with Sam',
          subtitle: 'Nóma · Table for 2',
          status: 'Confirmed',
          rows: [
            ['Reservation', '7:30 PM · window seat'],
            ['Calendar updated', 'Last call ends at 6:45 PM'],
            ['Invite', 'Sam accepted']
          ]
        },
        followups: ['Add flowers to the table', 'Move it to 8 PM', 'Share the menu with Sam'],
        live: {
          title: 'Dinner with Sam',
          subtitle: 'Reservation confirmed. Finalizing details.',
          steps: ['Checked your evening calendar', 'Found a window table at Nóma', 'Reserved 7:30 PM for 2'],
          done: 'Dinner is set. Nothing else needs you.'
        }
      };
    }
    if (/(focus|deep work|45|timer)/.test(lower)) {
      return {
        eyebrow: 'Focus mode',
        lead: 'Your 45-minute focus session starts now. I silenced non-urgent notifications and moved two low-priority calls to the afternoon.',
        card: {
          title: 'Deep work',
          subtitle: '45 min · 9:15 – 10:00 AM',
          status: 'Active',
          rows: [
            ['Notifications', 'Paused except Sam and Mom'],
            ['Calendar', '2 calls moved to 2:00 PM'],
            ['Timer', 'Ends at 10:00 AM']
          ]
        },
        followups: ['Play focus music', 'Extend by 15 min', 'Tell my team'],
        live: {
          title: 'Focus session',
          subtitle: 'Protecting your next 45 minutes.',
          steps: ['Paused non-urgent alerts', 'Moved two low-priority calls', 'Started a 45-minute timer'],
          done: 'Focus mode is active. I will nudge you at 10:00.'
        }
      };
    }
    if (/(summar|brief|my day|morning|schedule|calendar)/.test(lower)) {
      return {
        eyebrow: 'Your day',
        lead: 'Three things need you: the 10:00 product sync, a contract signature before noon, and dinner with Sam at 7:30. Everything else is handled.',
        card: {
          title: 'Today at a glance',
          subtitle: '3 decisions · 2 hours of focus left',
          status: 'Clear',
          rows: [
            ['10:00 AM', 'Product sync · 30 min'],
            ['11:30 AM', 'Sign the Northwind contract'],
            ['7:30 PM', 'Dinner with Sam at Nóma']
          ]
        },
        followups: ['Move my 3pm call', 'Block focus time', 'What can I skip?'],
        live: {
          title: 'Daily sweep',
          subtitle: 'Keeping your day on track.',
          steps: ['Read 14 new messages', 'Checked calendar conflicts', 'Flagged the 3 things that need you'],
          done: 'Your day is clear. I will keep watching.'
        }
      };
    }
    if (/(move|resched|meeting|call|3pm)/.test(lower)) {
      return {
        eyebrow: 'Rescheduled',
        lead: 'The 3:00 PM call is now at 3:30 PM. I let everyone know, updated the room booking, and protected your focus block before it.',
        card: {
          title: 'Product sync',
          subtitle: 'Moved to 3:30 PM',
          status: 'Updated',
          rows: [
            ['Attendees notified', '4 of 4 confirmed'],
            ['Room', 'Alder · 30 min'],
            ['Focus block', '2:30 – 3:15 PM protected']
          ]
        },
        followups: ['Keep it at 3:30', 'Move it to tomorrow', 'Add an agenda'],
        live: {
          title: 'Product sync',
          subtitle: 'Rescheduling and notifying the room.',
          steps: ['Found a 3:30 PM opening', 'Notified all attendees', 'Updated the room booking'],
          done: 'Call moved. Everyone is confirmed.'
        }
      };
    }
    return {
      eyebrow: 'On it',
      lead: 'I can take that from here. Here is the plan I would run — approve the first step and I will keep going.',
      card: {
        title: 'Your request',
        subtitle: 'Drafted by Mira · 3 steps',
        status: 'Ready',
        rows: [
          ['Understand the context', 'Checked calendar, messages, and maps'],
          ['Prepare the next action', 'Ready for your approval'],
          ['Follow through', 'I will report back when it is done']
        ]
      },
      followups: ['Plan my evening', 'Order a flat white', 'Summarize my day'],
      live: {
        title: 'New request',
        subtitle: 'Building a plan with your context.',
        steps: ['Read your request', 'Gathered the right context', 'Prepared a 3-step plan'],
        done: 'Plan ready. Say the word and I will run it.'
      }
    };
  }

  function send(text) {
    const message = text.trim();
    if (!message || agentBusy) return;
    agentBusy = true;
    addUserMessage(message);
    input.value = '';

    typing.hidden = false;
    chatScroll.appendChild(typing);
    scrollToLatest();

    setTimeout(function () {
      const data = responseFor(message);
      data.time = currentTime();
      typing.hidden = true;
      addAgentMessage(data);
      updateLive(data);
      agentBusy = false;
      scrollToLatest();
    }, 850);
  }

  composer.addEventListener('submit', function (event) {
    event.preventDefault();
    send(input.value);
  });

  document.addEventListener('click', function (event) {
    const promptTrigger = event.target.closest('[data-prompt]');
    if (promptTrigger) {
      closeNav();
      send(promptTrigger.dataset.prompt || promptTrigger.textContent || '');
      return;
    }
    const toastTrigger = event.target.closest('[data-toast]');
    if (toastTrigger) {
      showToast(toastTrigger.dataset.toast);
      if (toastTrigger.classList.contains('nav-item')) {
        document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
        toastTrigger.classList.add('active');
      }
    }
  });

  const approveRide = document.getElementById('approveRide');
  if (approveRide) {
    approveRide.addEventListener('click', function () {
      if (approveRide.classList.contains('approved')) return;
      approveRide.classList.add('approved');
      approveRide.textContent = 'Ride confirmed';
      const card = document.getElementById('rideCard');
      card.classList.add('approved');
      const note = card.querySelector('.hold-note');
      if (note) note.textContent = 'Confirmed. Miguel is on his way at 4:10 PM.';
      showToast('Ride confirmed. Your driver details are in Wallet.');
    });
  }

  const menuButton = document.getElementById('menuButton');
  menuButton.addEventListener('click', function () {
    const open = shell.classList.toggle('nav-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  scrim.addEventListener('click', closeNav);

  document.getElementById('newRequest').addEventListener('click', function () {
    closeNav();
    input.focus();
    showToast('Tell Mira what you need. She will handle the rest.');
  });

  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.addEventListener('click', function (event) {
      event.preventDefault();
      document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
      item.classList.add('active');
      closeNav();
      showToast(item.dataset.view + ' is up to date. Mira is keeping watch.');
    });
  });

  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      input.focus();
      closeNav();
    }
    if (event.key === 'Escape') closeNav();
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      composer.requestSubmit();
    }
  });

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.body.dataset.appReady = 'true';
    });
  });
})();
