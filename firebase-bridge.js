(() => {
  const cfg = window.MILKFLOW_CONFIG || {};
  // Keep the existing MilkFlow sync engine enabled while routing its cloud calls to Firebase.
  cfg.enableCloudSync = true;
  cfg.supabaseUrl = cfg.supabaseUrl || 'firebase://firestore';
  cfg.supabasePublishableKey = cfg.supabasePublishableKey || 'firebase-web';
  if (!cfg.firebaseConfig || !window.firebase) return;

  if (!firebase.apps.length) firebase.initializeApp(cfg.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

  const getUser = () => auth.currentUser;
  const entriesRef = () => db.collection('users').doc(getUser().uid).collection('entries');
  const profileRef = () => db.collection('users').doc(getUser().uid).collection('private').doc('profile');

  function sessionShape(user) {
    return user ? { user: { id: user.uid, email: user.email } } : null;
  }

  function from(table) {
    if (table === 'milkflow_entries') {
      return {
        select() {
          return {
            async order(_field, opts = {}) {
              if (!getUser()) return { data: [], error: null };
              try {
                const snap = await entriesRef().get();
                let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                data.sort((a,b) => String(a.occurred_at || '').localeCompare(String(b.occurred_at || '')));
                if (opts.ascending === false) data.reverse();
                return { data, error: null };
              } catch (error) { return { data: null, error }; }
            }
          };
        },
        async upsert(payload) {
          if (!getUser()) return { data: null, error: new Error('Not signed in') };
          try {
            const { id, user_id, ...rest } = payload;
            await entriesRef().doc(id).set({ ...rest, updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            return { data: payload, error: null };
          } catch (error) { return { data: null, error }; }
        }
      };
    }

    if (table === 'milkflow_profile') {
      return {
        select() {
          return {
            async maybeSingle() {
              if (!getUser()) return { data: null, error: null };
              try {
                const snap = await profileRef().get();
                return { data: snap.exists ? snap.data() : null, error: null };
              } catch (error) { return { data: null, error }; }
            }
          };
        },
        async upsert(payload) {
          if (!getUser()) return { data: null, error: new Error('Not signed in') };
          try {
            const { user_id, ...rest } = payload;
            await profileRef().set({ ...rest, updated_at: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            return { data: payload, error: null };
          } catch (error) { return { data: null, error }; }
        }
      };
    }
    throw new Error(`Unsupported cloud table: ${table}`);
  }

  // Compatibility surface used by MilkFlow's existing local-first sync layer.
  window.supabase = {
    createClient() {
      return {
        auth: {
          async getSession() { return { data: { session: sessionShape(getUser()) } }; },
          onAuthStateChange(callback) {
            const unsub = auth.onAuthStateChanged(user => callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', sessionShape(user)));
            return { data: { subscription: { unsubscribe: unsub } } };
          }
        },
        from
      };
    }
  };

  function ensureAuthUI() {
    if (document.getElementById('firebaseAuthDialog')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'firebaseAuthDialog';
    dlg.className = 'dialog small-dialog';
    dlg.innerHTML = `
      <form method="dialog" id="firebaseAuthForm">
        <div class="dialog-head"><div><span class="eyebrow">PRIVATE CLOUD</span><h2>MilkFlow account</h2></div><button class="icon-btn" value="cancel">×</button></div>
        <p id="firebaseAuthStatus" style="margin:0 0 14px;color:var(--muted);font-size:12px">Sign in to sync this device with your private Firestore data.</p>
        <label>Email<input id="firebaseEmail" type="email" autocomplete="email" required></label>
        <label style="margin-top:10px">Password<input id="firebasePassword" type="password" autocomplete="current-password" minlength="6" required></label>
        <div class="dialog-actions" style="justify-content:space-between;flex-wrap:wrap">
          <button class="btn ghost" type="button" id="firebaseSignOut" style="display:none">Sign out</button>
          <div style="display:flex;gap:8px;margin-left:auto"><button class="btn ghost" type="button" id="firebaseCreate">Create account</button><button class="btn primary" type="button" id="firebaseSignIn">Sign in</button></div>
        </div>
      </form>`;
    document.body.appendChild(dlg);

    const email = document.getElementById('firebaseEmail');
    const password = document.getElementById('firebasePassword');
    const status = document.getElementById('firebaseAuthStatus');
    const signin = document.getElementById('firebaseSignIn');
    const create = document.getElementById('firebaseCreate');
    const signout = document.getElementById('firebaseSignOut');

    const showError = e => { status.textContent = e?.message || 'Authentication failed'; status.style.color = '#b42318'; };
    signin.onclick = async () => { try { await auth.signInWithEmailAndPassword(email.value.trim(), password.value); dlg.close(); } catch(e){ showError(e); } };
    create.onclick = async () => { try { await auth.createUserWithEmailAndPassword(email.value.trim(), password.value); dlg.close(); } catch(e){ showError(e); } };
    signout.onclick = async () => { await auth.signOut(); dlg.close(); };

    auth.onAuthStateChanged(user => {
      if (user) {
        status.textContent = `Signed in as ${user.email}`;
        status.style.color = '';
        email.value = user.email || '';
        password.value = '';
        signin.style.display = 'none'; create.style.display = 'none'; signout.style.display = '';
      } else {
        status.textContent = 'Sign in to sync this device with your private Firestore data.';
        status.style.color = '';
        signin.style.display = ''; create.style.display = ''; signout.style.display = 'none';
      }
      updateCloudButton(user);
    });
  }

  function updateCloudButton(user) {
    const btn = document.getElementById('cloudAccountBtn');
    if (!btn) return;
    btn.innerHTML = user ? '<span>☁</span>Cloud account ✓' : '<span>☁</span>Cloud sign in';
    btn.title = user ? `Signed in as ${user.email || ''}` : 'Sign in to Firebase';
  }

  function relabelFirebase(root = document) {
    root.querySelectorAll('*').forEach(node => {
      if (node.children.length === 0 && typeof node.textContent === 'string' && node.textContent.includes('Supabase')) {
        node.textContent = node.textContent.replaceAll('Supabase', 'Firebase');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureAuthUI();
    const nav = document.querySelector('.sidebar-bottom');
    if (nav && !document.getElementById('cloudAccountBtn')) {
      const btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.id = 'cloudAccountBtn';
      btn.innerHTML = '<span>☁</span>Cloud sign in';
      btn.onclick = () => document.getElementById('firebaseAuthDialog').showModal();
      nav.insertBefore(btn, nav.firstChild);
      updateCloudButton(getUser());
    }
    relabelFirebase();
    new MutationObserver(() => relabelFirebase()).observe(document.getElementById('content'), { subtree:true, childList:true });
  });
})();
