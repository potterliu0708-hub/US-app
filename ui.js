// ui.js — Hooks · Screens · Navigation
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, FlatList, Switch, Alert,
  Animated, Dimensions, ActivityIndicator, PanResponder,
  KeyboardAvoidingView, Platform, ActionSheetIOS,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { NavigationContainer }       from '@react-navigation/native';
import { createBottomTabNavigator }  from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets }         from 'react-native-safe-area-context';
import FastImage                     from 'react-native-fast-image';

import {
  subscribePhotos, toggleLike, addComment, uploadPhoto,
  initMyCode, pairWithCode, unpair as fbUnpair,
  subscribeMyUser, fetchPartnerName,
  registerDevice, listenForegroundMessages,
  requestPermission, clearBadge,
} from './services';

const { width: SW } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:'#f2f2f7', white:'#fff', text:'#111', muted:'rgba(0,0,0,.28)',
  sep:'rgba(0,0,0,.08)', fill:'rgba(0,0,0,.055)',
  blue:'#007aff', green:'#34c759', red:'#ff3b30', pink:'#ff2d55',
  cardW:353, cardH:282, rCard:32,
  shadowMd:{ shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:.10, shadowRadius:14, elevation:4 },
  shadowLg:{ shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:.13, shadowRadius:28, elevation:8 },
};

// ══ HOOKS ════════════════════════════════════════════════════════════════════

// usePhotos — real-time Firebase + optimistic updates
export function usePhotos(senderName = '我') {
  const [days,    setDays]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [flash,   setFlash]   = useState(null);
  const pending    = useRef({});
  const flashTimer = useRef(null);

  useEffect(() => () => clearTimeout(flashTimer.current), []);
  useEffect(() => {
    const unsub = subscribePhotos(fresh => { setDays(fresh); setLoading(false); });
    return unsub;
  }, []);

  const patch = useCallback((dayKey, photoId, update) =>
    setDays(ds => ds.map(d =>
      d.key !== dayKey ? d : { ...d, photos: d.photos.map(p => p.id !== photoId ? p : { ...p, ...update }) }
    )), []);

  const love = useCallback((dayKey, photo) => {
    if (pending.current[photo.id]) return;
    pending.current[photo.id] = true;
    const prev = { liked: photo.liked };
    patch(dayKey, photo.id, { liked: !photo.liked });
    toggleLike(dayKey, photo.id)
      .then(c => { if (c) patch(dayKey, photo.id, { liked: c.liked }); })
      .catch(() => patch(dayKey, photo.id, prev))
      .finally(() => delete pending.current[photo.id]);
  }, [patch]);

  const onDoubleTap = useCallback((dayKey, photo) => {
    if (!photo.liked) love(dayKey, photo);
    clearTimeout(flashTimer.current);
    setFlash(photo.id);
    flashTimer.current = setTimeout(() => setFlash(null), 820);
  }, [love]);

  const addCmt = useCallback((dayKey, photoId, text) => {
    if (!text?.trim()) return;
    const tmp = { id:`tmp_${Date.now()}`, name:senderName, text:text.trim(), mine:true, ts:Date.now() };
    setDays(ds => ds.map(d =>
      d.key !== dayKey ? d : {
        ...d, photos: d.photos.map(p =>
          p.id !== photoId ? p : { ...p, comments:[...(p.comments??[]),tmp] })
      }
    ));
    addComment(dayKey, photoId, text, senderName).catch(console.error);
  }, [senderName]);

  return {
    days, allPhotos: days.flatMap(d=>d.photos), loading, flash,
    love, onDoubleTap, addCmt,
    upload: useCallback(uri => uploadPhoto(uri, senderName), [senderName]),
  };
}

// useSwipe — PanResponder-based, shared by photo strip & day zone
export function useSwipe({ count, cardW, initialIdx = 0, onCommit }) {
  const [idx,      setIdx]      = useState(initialIdx);
  const [offset,   setOffset]   = useState(0);
  const [snapping, setSnapping] = useState(false);
  const snapTimer = useRef(null);
  const t0        = useRef(null);

  useEffect(() => { setIdx(initialIdx); }, [initialIdx]);
  useEffect(() => () => clearTimeout(snapTimer.current), []);

  const commit = (dx, dt) => {
    const flick = Math.abs(dx / Math.max(dt,1)) > 0.35;
    let next = idx;
    if ((dx < -cardW*.22 || (flick && dx<0)) && idx < count-1) next = idx+1;
    if ((dx >  cardW*.22 || (flick && dx>0)) && idx > 0)       next = idx-1;
    setIdx(next); setOffset(0); setSnapping(true);
    onCommit?.(next, next !== idx);
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => setSnapping(false), 320);
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dx)>6 && Math.abs(g.dy)<Math.abs(g.dx)*.9,
    onPanResponderGrant:   (_, g) => { t0.current = Date.now(); setSnapping(false); },
    onPanResponderMove:    (_, g) => {
      const dx = g.dx;
      if ((dx>0 && idx===0) || (dx<0 && idx===count-1)) return;
      setOffset(dx);
    },
    onPanResponderRelease: (_, g) => commit(g.dx, Date.now()-t0.current),
  });

  return { idx, offset, snapping, panResponder };
}

// usePairing
export function usePairing() {
  const [myCode,      setMyCode]      = useState('');
  const [paired,      setPaired]      = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => { initMyCode().then(setMyCode).catch(console.error); }, []);
  useEffect(() => {
    const unsub = subscribeMyUser(async data => {
      const pid = data?.partnerId;
      if (pid) { setPaired(true); setPartnerName(await fetchPartnerName(pid)); }
      else     { setPaired(false); setPartnerName(''); }
      setLoading(false);
    });
    return unsub;
  }, []);

  const pair   = useCallback(async code => {
    setError('');
    try { await pairWithCode(code); } catch(e) { setError(e.message); throw e; }
  }, []);
  const unpair = useCallback(async () => {
    setError('');
    try { await fbUnpair(); } catch(e) { setError(e.message); }
  }, []);

  return { myCode, paired, partnerName, loading, error, pair, unpair };
}

// useNotifications
export function useNotifications() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    registerDevice().then(t => { if (t) setEnabled(true); }).catch(console.error);
    clearBadge();
    return listenForegroundMessages();
  }, []);
  const toggle = useCallback(async () => {
    if (enabled) { setEnabled(false); return; }
    if (await requestPermission()) { await registerDevice(); setEnabled(true); }
  }, [enabled]);
  return { enabled, toggle };
}

// ══ COMPONENTS ═══════════════════════════════════════════════════════════════

// HeartFlash — Animated heart overlay
function HeartFlash({ visible }) {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale,   { toValue:1.08, useNativeDriver:true }),
        Animated.timing(opacity, { toValue:1, duration:120, useNativeDriver:true }),
      ]),
      Animated.timing(scale,   { toValue:1, duration:200, useNativeDriver:true }),
      Animated.delay(300),
      Animated.timing(opacity, { toValue:0, duration:200, useNativeDriver:true }),
    ]).start(() => { scale.setValue(0); opacity.setValue(0); });
  }, [visible]);
  return (
    <Animated.View style={[cs.hflash, { opacity, transform:[{scale}] }]} pointerEvents="none">
      <Text style={{ fontSize:86 }}>❤️</Text>
    </Animated.View>
  );
}

// PhotoCard — fixed card, inner photo strip slides
function PhotoCard({ photos, likedMap, onLove, flash }) {
  const swipe   = useSwipe({ count:photos.length, cardW:T.cardW });
  const cur     = photos[swipe.idx];
  const liked   = likedMap[cur?.id] ?? cur?.liked;
  const lastTap = useRef({});

  const onTap = id => {
    const now = Date.now();
    if (lastTap.current[id] && now-lastTap.current[id] < 320) {
      onLove(id); lastTap.current[id] = 0;
    } else { lastTap.current[id] = now; }
  };

  return (
    <View style={[cs.card, T.shadowLg]} {...swipe.panResponder.panHandlers}>
      <Animated.View style={[cs.strip, { transform:[{translateX: -(swipe.idx*T.cardW)+swipe.offset }] }]}>
        {photos.map(p => (
          <TouchableOpacity key={p.id} activeOpacity={1} onPress={() => onTap(p.id)} style={cs.slide}>
            <FastImage source={{ uri:p.url, priority:FastImage.priority.high }}
              style={cs.img} resizeMode={FastImage.resizeMode.cover}/>
          </TouchableOpacity>
        ))}
      </Animated.View>
      <View style={cs.gradT} pointerEvents="none"/>
      <View style={cs.gradB} pointerEvents="none"/>
      <View style={cs.sender} pointerEvents="none">
        <View style={cs.sav}><Text style={{ fontSize:10 }}>{cur?.mine?'🙂':'👤'}</Text></View>
        <Text style={cs.sname}>{cur?.sender}</Text>
        <Text style={cs.stime}>{cur?.time}</Text>
      </View>
      {photos.length > 1 && (
        <View style={cs.dots} pointerEvents="none">
          {photos.map((_,i) => <View key={i} style={[cs.dot, i===swipe.idx&&cs.dotOn]}/>)}
        </View>
      )}
      <HeartFlash visible={flash === cur?.id}/>
    </View>
  );
}

// CommentPanel
function CommentPanel({ photo, dayKey, likedMap, onLove, onAddComment, onClose }) {
  const [draft, setDraft] = useState('');
  const liked = likedMap[photo.id] ?? photo.liked;   // always fresh from map
  const send = () => {
    if (!draft.trim()) return;
    onAddComment(dayKey, photo.id, draft);
    setDraft('');
  };
  return (
    <View style={cs.panel}>
      <View style={cs.phdr}>
        <Text style={cs.ptitle}>留言</Text>
        <TouchableOpacity onPress={onClose} style={cs.pclose}>
          <Text style={{ fontSize:13, color:T.text }}>✕</Text>
        </TouchableOpacity>
      </View>
      {(photo.comments?.length ?? 0) > 0 && (
        <ScrollView style={{ maxHeight:110 }} showsVerticalScrollIndicator={false}>
          {photo.comments.map((c,i) => (
            <View key={i} style={cs.citem}>
              <View style={cs.cav}><Text style={{ fontSize:12 }}>{c.mine?'🙂':'👤'}</Text></View>
              <View>
                <Text style={cs.cname}>{c.name}</Text>
                <Text style={cs.ctext}>{c.text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={cs.cbar}>
        <TextInput style={cs.cinput} placeholder="說點什麼…" placeholderTextColor={T.muted}
          value={draft} onChangeText={setDraft} returnKeyType="send" onSubmitEditing={send} autoFocus/>
        <TouchableOpacity style={[cs.csend, !draft.trim()&&cs.csendDis]}
          disabled={!draft.trim()} onPress={send}>
          <Text style={{ fontSize:15, color:'#fff', fontWeight:'600' }}>↑</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLove} style={cs.cheart}>
          <Text style={{ fontSize:20 }}>{liked?'❤️':'🤍'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ══ SCREENS ══════════════════════════════════════════════════════════════════

function FeedScreen({ photosHook, days, dayIdx, setDayIdx, onToast }) {
  const [showCmt, setShowCmt] = useState(false);
  const [pop,     setPop]     = useState(false);
  const popTimer = useRef(null);
  const mounted  = useRef(true);
  useEffect(() => () => { mounted.current=false; clearTimeout(popTimer.current); }, []);
  useEffect(() => { setShowCmt(false); }, [dayIdx]);

  const photos   = days[dayIdx]?.photos ?? [];
  const curPhoto = photos[0] ?? null;
  const liked    = curPhoto ? (photosHook.likedMap?.[curPhoto.id] ?? curPhoto.liked) : false;

  if (photosHook.loading) return <View style={fs.center}><ActivityIndicator color={T.blue} size="large"/></View>;
  if (!photos.length) return (
    <View style={fs.center}>
      <Text style={{ fontSize:40, marginBottom:10 }}>📷</Text>
      <Text style={{ fontSize:15, color:T.muted }}>這天還沒有照片</Text>
    </View>
  );

  const doHeart = () => {
    clearTimeout(popTimer.current); setPop(true);
    popTimer.current = setTimeout(() => { if (mounted.current) setPop(false); }, 350);
    photosHook.love(days[dayIdx].key, curPhoto);
    onToast(liked ? '取消愛心' : '已送出愛心 ❤️');
  };

  const daySwipe = useSwipe({
    count:days.length, cardW:SW, initialIdx:dayIdx,
    onCommit:(next,changed) => { if(changed){ setDayIdx(next); onToast(days[next].label); } },
  });

  return (
    <KeyboardAvoidingView
      style={fs.main}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={88}  // nav bar height
    >
      <View style={fs.cardWrap}>
        <PhotoCard photos={photos} likedMap={photosHook.likedMap??{}}
          onLove={id => photosHook.love(days[dayIdx].key, photos.find(p=>p.id===id))}
          flash={photosHook.flash}/>
      </View>
      <View style={fs.actions}>
        <TouchableOpacity testID="btn-comment" style={[fs.extBtn, T.shadowMd]}
          onPress={() => setShowCmt(v=>!v)} activeOpacity={0.85}>
          <Text style={{ fontSize:22 }}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="btn-heart"
          style={[fs.extBtn, T.shadowMd, liked&&fs.extBtnLiked]}
          onPress={doHeart} activeOpacity={0.85}>
          <Text style={{ fontSize:22 }}>{liked?'❤️':'🤍'}</Text>
        </TouchableOpacity>
      </View>
      {showCmt && curPhoto && (
        <CommentPanel photo={curPhoto} dayKey={days[dayIdx].key}
          likedMap={photosHook.likedMap ?? {}}
          onLove={() => photosHook.love(days[dayIdx].key, curPhoto)}
          onAddComment={(dk,id,t) => photosHook.addCmt(dk,id,t)}
          onClose={() => setShowCmt(false)}/>
      )}
      <View style={fs.dayZone} {...daySwipe.panResponder.panHandlers}>
        <View style={fs.dayLine}/>
      </View>
    </KeyboardAvoidingView>
  );
}({ allPhotos, likedMap }) {
  const COLS      = 3;
  const CELL_W    = (SW - (COLS-1)*1.5) / COLS;
  const CELL_H    = CELL_W * (4/5);       // 5:4 aspect
  const ROW_H     = CELL_H + 1.5;         // cell + separator

  // getItemLayout avoids layout measurement for every item — critical for 100s of photos
  const getItemLayout = useCallback((_, index) => {
    const row = Math.floor(index / COLS);
    return { length: CELL_H, offset: row * ROW_H, index };
  }, [CELL_H, ROW_H]);

  const renderItem = useCallback(({ item: p }) => (
    <View style={{ width:CELL_W, height:CELL_H, backgroundColor:'#ddd' }}>
      <FastImage source={{ uri:p.url }} style={{ width:'100%', height:'100%' }}
        resizeMode={FastImage.resizeMode.cover}/>
      {(likedMap[p.id]??p.liked) && (
        <Text style={{ position:'absolute', bottom:5, right:5, fontSize:12 }}>❤️</Text>
      )}
    </View>
  ), [likedMap, CELL_W, CELL_H]);

  return (
    <FlatList testID="album-grid"
      data={allPhotos}
      numColumns={COLS}
      keyExtractor={p => String(p.id)}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      initialNumToRender={12}        // 4 rows × 3 cols visible above fold
      windowSize={5}                 // render 5 screens worth (2.5 above + 2.5 below)
      maxToRenderPerBatch={9}        // 3 rows per batch
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={true}
      ItemSeparatorComponent={() => <View style={{ height:1.5 }}/>}
      columnWrapperStyle={{ gap:1.5 }}
    />
  );
}

function SettingsScreen({ pairing, notifications }) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [busy,  setBusy]  = useState(false);

  const doPair = async () => {
    setBusy(true);
    try { await pairing.pair(input.trim()); setInput(''); Alert.alert('配對成功 🎉'); }
    catch(e) { Alert.alert('配對失敗', e.message); }
    finally { setBusy(false); }
  };

  const doUnpair = () =>
    Alert.alert('解除配對','確定要解除配對嗎？',
      [{text:'取消',style:'cancel'},{text:'解除',style:'destructive',onPress:pairing.unpair}]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom:insets.bottom+20 }} showsVerticalScrollIndicator={false}>
      <Text style={ss.sec}>配對</Text>
      <View style={ss.card}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, padding:14 }}>
          <View style={[ss.pip, pairing.paired?ss.pipOn:ss.pipOff]}/>
          <View>
            <Text style={ss.ptitle}>{pairing.paired?`已配對：${pairing.partnerName}`:'尚未配對'}</Text>
            <Text style={{ fontSize:13, color:T.muted }}>{pairing.paired?'即時同步中':'輸入對方配對碼'}</Text>
          </View>
        </View>
      </View>
      <View style={ss.cbox}>
        <Text style={ss.clbl}>我的配對碼</Text>
        <Text testID="my-pairing-code" style={ss.cval}>{pairing.myCode}</Text>
      </View>
      <View style={{ flexDirection:'row', gap:8, marginHorizontal:16, marginBottom:4 }}>
        {!pairing.paired ? (
          <>
            <TextInput testID="input-pairing-code" style={ss.pin}
              placeholder="輸入對方配對碼" placeholderTextColor={T.muted}
              value={input} onChangeText={t => setInput(t.toUpperCase().slice(0,8))}
              autoCapitalize="characters" returnKeyType="done" onSubmitEditing={doPair}/>
            <TouchableOpacity testID="btn-pair"
              style={[ss.pbtn, (input.length<4||busy)&&ss.pbtnDis]}
              disabled={input.length<4||busy} onPress={doPair}>
              <Text style={ss.pbtntxt}>{busy?'…':'配對'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity testID="btn-unpair"
            style={[ss.pbtn, ss.pbtnDanger]} onPress={doUnpair}>
            <Text style={[ss.pbtntxt,{color:T.red}]}>解除配對</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={ss.sec}>通知</Text>
      <View style={ss.group}>
        {[['🔔','rgba(255,59,48,.14)','推播通知',true],
          ['❤️','rgba(255,45,85,.14)','對方愛心時通知',false],
          ['📸','rgba(0,122,255,.12)','對方分享照片',false]
        ].map(([ic,bg,lb,main],i,arr) => (
          <View key={i} style={[ss.row, i===arr.length-1&&ss.rowLast, !main&&!notifications.enabled&&{opacity:.4}]}>
            <View style={[ss.ic,{backgroundColor:bg}]}><Text style={{fontSize:16}}>{ic}</Text></View>
            <Text style={ss.lbl}>{lb}</Text>
            <Switch value={notifications.enabled} onValueChange={main?notifications.toggle:()=>{}}
              trackColor={{false:T.fill,true:T.green}} thumbColor="#fff"/>
          </View>
        ))}
      </View>
      <Text style={ss.sec}>帳號</Text>
      <View style={ss.group}>
        <View style={ss.row}>
          <View style={[ss.ic,{backgroundColor:'rgba(0,0,0,.06)'}]}><Text style={{fontSize:16}}>👤</Text></View>
          <Text style={ss.lbl}>顯示名稱</Text>
          <Text style={{fontSize:14,color:T.muted}}>我</Text>
          <Text style={{fontSize:13,color:'rgba(0,0,0,.2)',marginLeft:2}}>›</Text>
        </View>
        <View style={[ss.row,ss.rowLast]}>
          <View style={[ss.ic,{backgroundColor:'rgba(255,149,0,.14)'}]}><Text style={{fontSize:16}}>🍎</Text></View>
          <Text style={ss.lbl}>Apple 登入</Text>
          <Text style={{fontSize:14,color:T.muted}}>已連結</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ══ DATE DRAWER ══════════════════════════════════════════════════════════════
function DateDrawer({ days, dayIdx, onSelect, visible, onClose }) {
  const x = useRef(new Animated.Value(-280)).current;
  useEffect(() => {
    Animated.timing(x, { toValue:visible?0:-280, duration:240, useNativeDriver:true }).start();
  }, [visible]);
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,.22)' }}
        activeOpacity={1} onPress={onClose}/>
      <Animated.View testID="date-drawer"
        style={[dd.drawer, { transform:[{translateX:x}] }]}>
        <Text style={dd.title}>選擇日期</Text>
        {days.map((day,i) => (
          <TouchableOpacity key={day.key} testID={`day-item-${day.key}`}
            style={[dd.item, i===dayIdx&&dd.itemActive]}
            onPress={() => { onSelect(i); onClose(); }}>
            <View style={[dd.dot, i===dayIdx&&dd.dotActive]}/>
            <View style={{flex:1}}>
              <Text style={dd.label}>{day.label}</Text>
              <Text style={dd.date}>{day.date}</Text>
            </View>
            <Text style={dd.count}>{day.photos.length} 張</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

// ══ NAVIGATION ═══════════════════════════════════════════════════════════════
export function Navigation({ photosHook, pairing, notifications }) {
  const insets     = useSafeAreaInsets();
  const [dayIdx,   setDayIdx]  = useState(0);
  const [drawer,   setDrawer]  = useState(false);
  const [toast,    setToast]   = useState(null);
  // Upload state
  const [upSrc,    setUpSrc]   = useState(null);   // local URI preview
  const [uploading,setUploading]= useState(false);
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = msg => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // ── + button: ActionSheet → camera / library ────────────────────────────
  const openPicker = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options:['取消','拍照','從相簿選取'], cancelButtonIndex:0 },
      async btn => {
        if (btn === 0) return;
        const opts = {
          mediaType:        'photo',
          includeBase64:    false,
          saveToPhotos:     false,
          // Standardise to 1080px on the longer edge, JPEG at 0.92 quality
          // react-native-image-picker resizes proportionally when one dimension is set
          maxWidth:         1080,
          maxHeight:        1080,
          quality:          0.92,          // 0.92 = visually lossless for JPEG
          // Force JPEG output regardless of source format (HEIC/PNG/WEBP → JPG)
          // NOTE: requires react-native-image-picker ≥ 7.x
          compressImageQuality: 0.92,
        };
        const res = btn === 1
          ? await launchCamera(opts)
          : await launchImageLibrary(opts);
        if (res.didCancel || res.errorCode) return;
        const asset = res.assets?.[0];
        if (asset?.uri) setUpSrc(asset.uri);
      }
    );
  };

  const confirmUpload = async () => {
    if (!upSrc) return;
    setUploading(true);
    try {
      await photosHook.upload(upSrc);
      showToast('照片已分享 📸');
    } catch (e) {
      showToast('上傳失敗，請重試');
      console.error(e);
    } finally {
      setUploading(false);
      setUpSrc(null);
    }
  };

  const days   = photosHook.days;
  const curDay = days[dayIdx] ?? { label:'', date:'' };

  const [likedMap, setLikedMap] = useState(() =>
    Object.fromEntries((photosHook.allPhotos||[]).map(p=>[p.id,p.liked]))
  );
  useEffect(() => {
    setLikedMap(Object.fromEntries((photosHook.allPhotos||[]).map(p=>[p.id,p.liked])));
  }, [photosHook.days]);

  const handleLove = (dayKey, photo) => {
    setLikedMap(m => ({...m,[photo.id]:!m[photo.id]}));
    photosHook.love(dayKey, photo);
  };
  const wrappedHook = { ...photosHook, likedMap, love:handleLove };

  return (
    <NavigationContainer>
      {/* Custom nav bar */}
      <View style={[nav.bar, { paddingTop:insets.top+8 }]}>
        <TouchableOpacity testID="btn-hamburger" onPress={() => setDrawer(true)} style={nav.hamburger}>
          <View style={nav.line}/><View style={nav.line}/><View style={nav.line}/>
        </TouchableOpacity>
        <View style={nav.mid}>
          <Text testID="nav-day-label" style={nav.label}>{curDay.label}</Text>
          <Text style={nav.date}>{curDay.date}</Text>
        </View>
        <TouchableOpacity style={nav.addBtn} onPress={openPicker}>
          <Text style={{fontSize:18,color:T.text}}>＋</Text>
        </TouchableOpacity>
      </View>

      <Tab.Navigator screenOptions={{
        headerShown:false,
        tabBarShowLabel:false,
        tabBarStyle:{ height:68+insets.bottom, paddingBottom:insets.bottom+8,
          backgroundColor:'rgba(255,255,255,.92)', borderTopWidth:.5, borderTopColor:T.sep },
      }}>
        <Tab.Screen name="Feed"
          options={{ tabBarIcon:({focused}) => <Text style={{fontSize:24,color:focused?T.text:'rgba(0,0,0,.28)'}}>🏠</Text> }}>
          {() => <FeedScreen photosHook={wrappedHook} days={days} dayIdx={dayIdx} setDayIdx={setDayIdx} onToast={showToast}/>}
        </Tab.Screen>
        <Tab.Screen name="Album"
          options={{ tabBarIcon:({focused}) => <Text style={{fontSize:24,color:focused?T.text:'rgba(0,0,0,.28)'}}>🖼️</Text> }}>
          {() => <AlbumScreen allPhotos={photosHook.allPhotos} likedMap={likedMap}/>}
        </Tab.Screen>
        <Tab.Screen name="Settings"
          options={{ tabBarIcon:() => (
            <View>
              <Text style={{fontSize:24,color:'rgba(0,0,0,.28)'}}>⚙️</Text>
              {!pairing.paired && <View style={nav.badge}/>}
            </View>
          )}}>
          {() => <SettingsScreen pairing={pairing} notifications={notifications}/>}
        </Tab.Screen>
      </Tab.Navigator>

      <DateDrawer days={days} dayIdx={dayIdx} onSelect={setDayIdx} visible={drawer} onClose={() => setDrawer(false)}/>
      {toast && <View style={nav.toast} pointerEvents="none"><Text style={nav.toastTxt}>{toast}</Text></View>}

      {/* ── Upload preview sheet ── */}
      {upSrc && (
        <View style={up.bg}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !uploading && setUpSrc(null)}/>
          <View style={up.sheet}>
            <View style={up.handle}/>
            <Text style={up.title}>分享這張照片</Text>
            <Image source={{ uri:upSrc }} style={up.preview} resizeMode="cover"/>
            <View style={up.row}>
              <TouchableOpacity style={[up.btn, up.cancel]} onPress={() => setUpSrc(null)} disabled={uploading}>
                <Text style={up.cancelTxt}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[up.btn, up.confirm, uploading&&up.disabled]}
                onPress={confirmUpload} disabled={uploading}>
                <Text style={up.confirmTxt}>{uploading ? '上傳中…' : '分享'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </NavigationContainer>
  );
}

// ══ STYLES ═══════════════════════════════════════════════════════════════════

// Card / photo
const cs = StyleSheet.create({
  card:   { width:T.cardW, height:T.cardH, borderRadius:T.rCard, overflow:'hidden', backgroundColor:'#d8d8d8' },
  strip:  { flexDirection:'row', height:'100%' },
  slide:  { width:T.cardW, height:'100%' },
  img:    { width:'100%', height:'100%', borderRadius:T.rCard },
  gradT:  { position:'absolute', top:0, left:0, right:0, height:90, backgroundColor:'rgba(0,0,0,.28)', borderTopLeftRadius:T.rCard, borderTopRightRadius:T.rCard },
  gradB:  { position:'absolute', bottom:0, left:0, right:0, height:130, backgroundColor:'rgba(0,0,0,.42)', borderBottomLeftRadius:T.rCard, borderBottomRightRadius:T.rCard },
  sender: { position:'absolute', top:11, left:11, flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(0,0,0,.26)', borderRadius:999, paddingVertical:3, paddingLeft:5, paddingRight:9, borderWidth:.5, borderColor:'rgba(255,255,255,.15)' },
  sav:    { width:18, height:18, borderRadius:9, backgroundColor:'rgba(255,255,255,.18)', alignItems:'center', justifyContent:'center' },
  sname:  { fontSize:11, fontWeight:'600', color:'#fff' },
  stime:  { fontSize:10, color:'rgba(255,255,255,.5)' },
  dots:   { position:'absolute', bottom:12, left:0, right:0, flexDirection:'row', justifyContent:'center', gap:6 },
  dot:    { width:7, height:7, borderRadius:3.5, borderWidth:1.5, borderColor:'rgba(255,255,255,.85)', backgroundColor:'transparent' },
  dotOn:  { backgroundColor:'#fff' },
  hflash: { position:'absolute', top:0, bottom:0, left:0, right:0, alignItems:'center', justifyContent:'center' },
  // panel
  panel:  { width:T.cardW, alignSelf:'center', backgroundColor:T.white, borderRadius:20, overflow:'hidden', marginTop:12, flexShrink:0, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:.09, shadowRadius:20, elevation:4 },
  phdr:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:12, borderBottomWidth:.5, borderBottomColor:T.sep },
  ptitle: { fontSize:14, fontWeight:'600', color:T.text },
  pclose: { width:26, height:26, borderRadius:13, backgroundColor:T.fill, alignItems:'center', justifyContent:'center' },
  citem:  { flexDirection:'row', gap:8, marginBottom:8, paddingHorizontal:10 },
  cav:    { width:24, height:24, borderRadius:12, backgroundColor:T.fill, alignItems:'center', justifyContent:'center', flexShrink:0 },
  cname:  { fontSize:10, fontWeight:'700', color:'rgba(0,0,0,.46)', marginBottom:1 },
  ctext:  { fontSize:13, color:T.text, lineHeight:18 },
  cbar:   { flexDirection:'row', alignItems:'center', gap:8, padding:10, borderTopWidth:.5, borderTopColor:T.sep },
  cinput: { flex:1, backgroundColor:T.fill, borderWidth:.5, borderColor:'rgba(0,0,0,.09)', borderRadius:999, paddingHorizontal:14, paddingVertical:9, fontSize:14, color:T.text },
  csend:  { width:34, height:34, borderRadius:17, backgroundColor:T.blue, alignItems:'center', justifyContent:'center' },
  csendDis:{ opacity:.3 },
  cheart: { width:34, height:34, borderRadius:17, backgroundColor:T.fill, alignItems:'center', justifyContent:'center' },
});

// Feed
const fs = StyleSheet.create({
  main:       { flex:1, alignItems:'center', justifyContent:'center' },
  center:     { flex:1, alignItems:'center', justifyContent:'center' },
  cardWrap:   { paddingHorizontal:(SW-T.cardW)/2 },
  actions:    { flexDirection:'row', justifyContent:'space-between', width:T.cardW, marginTop:16, flexShrink:0 },
  extBtn:     { width:50, height:50, borderRadius:25, backgroundColor:T.white, alignItems:'center', justifyContent:'center' },
  extBtnLiked:{ shadowColor:'#ff2d55', shadowOpacity:.28, shadowRadius:14, elevation:6 },
  dayZone:    { flex:1, width:'100%', alignItems:'center', justifyContent:'center' },
  dayLine:    { width:40, height:3, backgroundColor:'rgba(0,0,0,.12)', borderRadius:2 },
});

// Settings
const ss = StyleSheet.create({
  sec:      { fontSize:12, fontWeight:'600', color:T.muted, textTransform:'uppercase', letterSpacing:.7, padding:16, paddingBottom:6 },
  card:     { margin:16, marginBottom:8, backgroundColor:T.fill, borderRadius:14, overflow:'hidden' },
  pip:      { width:8, height:8, borderRadius:4 },
  pipOn:    { backgroundColor:T.green },
  pipOff:   { backgroundColor:'rgba(0,0,0,.2)' },
  ptitle:   { fontSize:15, fontWeight:'600', color:T.text },
  cbox:     { backgroundColor:'rgba(0,0,0,.04)', margin:16, marginTop:0, borderRadius:14, padding:16, alignItems:'center' },
  clbl:     { fontSize:11, fontWeight:'600', color:T.muted, textTransform:'uppercase', letterSpacing:.7, marginBottom:6 },
  cval:     { fontSize:28, fontWeight:'700', letterSpacing:6, color:T.text },
  pin:      { flex:1, backgroundColor:T.fill, borderWidth:.5, borderColor:'rgba(0,0,0,.1)', borderRadius:10, padding:11, fontSize:16, fontWeight:'700', color:T.text, letterSpacing:3, textAlign:'center' },
  pbtn:     { padding:11, paddingHorizontal:18, borderRadius:10, backgroundColor:T.blue, justifyContent:'center' },
  pbtnDis:  { opacity:.38 },
  pbtnDanger:{ backgroundColor:'rgba(255,59,48,.12)' },
  pbtntxt:  { fontSize:15, fontWeight:'600', color:'#fff' },
  group:    { margin:16, marginTop:0, backgroundColor:T.fill, borderRadius:14, overflow:'hidden' },
  row:      { flexDirection:'row', alignItems:'center', gap:12, padding:13, borderBottomWidth:.5, borderBottomColor:T.sep, minHeight:50 },
  rowLast:  { borderBottomWidth:0 },
  ic:       { width:30, height:30, borderRadius:8, alignItems:'center', justifyContent:'center' },
  lbl:      { flex:1, fontSize:16, color:T.text },
});

// Nav
const nav = StyleSheet.create({
  bar:      { backgroundColor:T.bg, flexDirection:'row', alignItems:'flex-end', paddingHorizontal:18, paddingBottom:12 },
  hamburger:{ padding:6, justifyContent:'center', gap:4 },
  line:     { width:22, height:2, backgroundColor:T.text, borderRadius:2 },
  mid:      { flex:1, alignItems:'center' },
  label:    { fontSize:17, fontWeight:'600', color:T.text, lineHeight:20 },
  date:     { fontSize:12, color:T.muted, marginTop:1 },
  addBtn:   { width:34, height:34, borderRadius:17, backgroundColor:T.fill, alignItems:'center', justifyContent:'center' },
  badge:    { position:'absolute', top:-2, right:-4, width:7, height:7, borderRadius:3.5, backgroundColor:T.red, borderWidth:1.5, borderColor:T.white },
  toast:    { position:'absolute', bottom:90, alignSelf:'center', backgroundColor:'rgba(0,0,0,.72)', borderRadius:20, paddingHorizontal:18, paddingVertical:9 },
  toastTxt: { color:'#fff', fontSize:13, fontWeight:'500' },
});

// Upload preview sheet
const up = StyleSheet.create({
  bg:         { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end', zIndex:60 },
  sheet:      { backgroundColor:T.white, borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom:40, paddingHorizontal:20 },
  handle:     { width:36, height:4, backgroundColor:'rgba(0,0,0,0.12)', borderRadius:2, alignSelf:'center', marginTop:12, marginBottom:16 },
  title:      { fontSize:17, fontWeight:'600', color:T.text, textAlign:'center', marginBottom:16 },
  preview:    { width:'100%', aspectRatio:5/4, borderRadius:16, marginBottom:20, backgroundColor:T.fill },
  row:        { flexDirection:'row', gap:12 },
  btn:        { flex:1, paddingVertical:14, borderRadius:14, alignItems:'center' },
  cancel:     { backgroundColor:T.fill },
  confirm:    { backgroundColor:T.blue },
  disabled:   { opacity:0.5 },
  cancelTxt:  { fontSize:16, fontWeight:'600', color:T.text },
  confirmTxt: { fontSize:16, fontWeight:'600', color:'#fff' },
});

// Drawer
const dd = StyleSheet.create({
  drawer:    { position:'absolute', top:0, left:0, bottom:0, width:260, backgroundColor:T.white, borderTopRightRadius:24, borderBottomRightRadius:24, paddingTop:80, shadowColor:'#000', shadowOffset:{width:6,height:0}, shadowOpacity:.14, shadowRadius:40, elevation:12 },
  title:     { fontSize:22, fontWeight:'700', color:T.text, marginBottom:8, paddingHorizontal:22 },
  item:      { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:13, paddingHorizontal:22, borderBottomWidth:.5, borderBottomColor:'rgba(0,0,0,.04)' },
  itemActive:{ backgroundColor:'rgba(0,122,255,.06)' },
  dot:       { width:9, height:9, borderRadius:4.5, backgroundColor:'rgba(0,0,0,.2)' },
  dotActive: { backgroundColor:T.blue },
  label:     { fontSize:16, fontWeight:'600', color:T.text },
  date:      { fontSize:13, color:T.muted },
  count:     { fontSize:13, color:T.muted },
});
