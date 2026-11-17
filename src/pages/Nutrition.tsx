import React, { useMemo, useRef, useState } from 'react';
import {
  LuCamera, LuCheck, LuRepeat, LuChevronLeft, LuChevronRight, LuImage, LuImageOff, LuImages, LuLoaderCircle, LuMinus, LuNotebookPen, LuPencil, LuPlus, LuX,
} from 'react-icons/lu';
import { useStore } from '../store';
import type { MealKind, MealLog } from '../types';
import { addDays, fmtLong, kindForHour, MEAL_KINDS, mealLabel, mealsOn, nf, relDay, todayKey, fmtDayMonth } from '../utils';
import { deletePhoto, savePhoto, usePhoto } from '../photos';
import { WaterCard } from '../components/Water';
import {
  Button, Card, cx, DeleteButton, DotDial, Empty, Field, IconButton, Input, Modal, PageHeader, Segmented, TextArea, Tile,
} from '../components/ui';

export function WaterButtons({ onAdd, compact }: { onAdd: (ml: number) => void; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[250, 500].map((ml) => (
        <button key={ml} type="button" onClick={(e) => { e.stopPropagation(); onAdd(ml); }}
          className="press h-10 px-4 rounded-full bg-surface text-ink text-[14px] font-medium tabular-nums">+{ml} ml</button>
      ))}
      {!compact && (
        <button type="button" onClick={() => onAdd(-250)} aria-label="Remover 250 ml"
          className="press size-10 rounded-full bg-surface grid place-items-center text-ink/60"><LuMinus size={15} /></button>
      )}
    </div>
  );
}

const nowHHMM = () => new Date().toTimeString().slice(0, 5);

export default function Nutrition() {
  const { state, actions, toast } = useStore();
  const [day, setDay] = useState(todayKey());
  const [view, setView] = useState<'diario' | 'galeria'>('diario');
  const [modal, setModal] = useState<{ meal?: MealLog } | null>(null);
  const [viewer, setViewer] = useState<{ ids: string[]; i: number } | null>(null);
  const meals = mealsOn(state, day);
  const goal = state.goals.meals || 4;
  const water = state.water[day] || 0;
  const isToday = day === todayKey();
  const done = new Set(meals.map((m) => m.kind));

  return (
    <div>
      <PageHeader title="Alimentação" sub="Registre o que comeu, com foto se quiser"
        right={<div className="hidden md:block"><Button variant="primary" size="lg" onClick={() => setModal({})}><LuPlus size={18} /> Registrar refeição</Button></div>} />

      <div className="mb-5">
        <Segmented value={view} onChange={setView} options={[
          { value: 'diario', label: <><LuNotebookPen size={15} /> Diário</> },
          { value: 'galeria', label: <><LuImages size={15} /> Galeria</> },
        ]} />
      </div>

      {view === 'galeria' ? (
        <Gallery onOpen={(ids, i) => setViewer({ ids, i })} onEdit={(m) => setModal({ meal: m })} />
      ) : (
        <>
          {/* navegação de dia */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <button aria-label="Dia anterior" onClick={() => setDay(addDays(day, -1))} className="press size-11 rounded-full bg-surface grid place-items-center text-ink"><LuChevronLeft size={19} /></button>
            <button onClick={() => setDay(todayKey())} className="text-center">
              <p className="text-[17px] font-medium text-ink">{relDay(day)}</p>
              <p className="text-[13px] text-muted">{fmtLong(day)}</p>
            </button>
            <button aria-label="Próximo dia" disabled={isToday} onClick={() => setDay(addDays(day, 1))} className="press size-11 rounded-full bg-surface grid place-items-center text-ink disabled:opacity-30"><LuChevronRight size={19} /></button>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-5 mb-4 md:mb-5">
            <Card className="p-5 md:p-7">
              <p className="text-[17px] text-ink">Refeições {isToday ? 'de hoje' : 'do dia'}</p>
              <p className="mt-4 flex items-baseline gap-2.5">
                <span className="text-[52px] md:text-[60px] font-medium tracking-[-0.05em] leading-none text-ink tabular-nums">{meals.length}</span>
                <span className="text-[15px] text-muted">de {goal} registradas</span>
              </p>
              <div className="flex flex-wrap gap-2 mt-5">
                {MEAL_KINDS.filter((k) => k.id !== 'outro').map((k) => (
                  <span key={k.id} className={cx('inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13.5px] font-medium',
                    done.has(k.id) ? 'bg-orange text-white' : 'bg-cream text-ink/55')}>
                    {done.has(k.id) && <LuCheck size={14} />}{k.label}
                  </span>
                ))}
              </div>
              <Button variant="primary" size="lg" className="w-full mt-6 md:hidden" onClick={() => setModal({})}>
                <LuCamera size={18} /> Registrar refeição
              </Button>
            </Card>

            <WaterCard day={day} />
          </div>

          {meals.length === 0 ? (
            <Card className="p-5">
              <Empty icon={<LuCamera />} title={isToday ? 'Nada registrado ainda hoje' : 'Nenhuma refeição neste dia'}
                text="Tire uma foto do prato e escreva em poucas palavras o que comeu."
                action={<Button variant="primary" onClick={() => setModal({})}><LuPlus size={16} /> Registrar refeição</Button>} />
            </Card>
          ) : (
            <ol className="relative space-y-3 md:space-y-4">
              {meals.map((m) => (
                <MealCard key={m.id} meal={m} onEdit={() => setModal({ meal: m })} onOpenPhoto={(i) => setViewer({ ids: m.photos, i })}
                  onRepeat={() => { actions.addMeal({ date: todayKey(), time: nowHHMM(), kind: m.kind, description: m.description, photos: [] }); setDay(todayKey()); toast('Refeição repetida hoje'); }} />
              ))}
            </ol>
          )}
        </>
      )}

      <MealModal open={!!modal} meal={modal?.meal} day={day} onClose={() => setModal(null)}
        onSave={(m, fav) => {
          if (fav && m.description) actions.addMealFavorite({ kind: m.kind, description: m.description });
          if (modal?.meal) { actions.updateMeal(modal.meal.id, m); toast('Refeição atualizada'); }
          else { actions.addMeal(m); toast(`${mealLabel(m.kind)} registrado`); if (m.date !== day) setDay(m.date); }
          setModal(null);
        }}
        onDelete={modal?.meal ? () => {
          modal.meal!.photos.forEach((p) => void deletePhoto(p));
          actions.deleteMeal(modal.meal!.id); setModal(null); toast('Refeição excluída');
        } : undefined} />

      {viewer && <PhotoViewer ids={viewer.ids} index={viewer.i} onClose={() => setViewer(null)} />}
    </div>
  );
}

/* ── card da refeição ─────────────────────────────────────── */
function MealCard({ meal, onEdit, onOpenPhoto, onRepeat }: { meal: MealLog; onEdit: () => void; onOpenPhoto: (i: number) => void; onRepeat: () => void }) {
  const first = meal.photos[0];
  return (
    <li>
      <Card className="p-3 md:p-4 flex gap-3 md:gap-4">
        {first ? (
          <button onClick={() => onOpenPhoto(0)} className="press relative shrink-0" aria-label="Ver foto">
            <Thumb id={first} className="size-20 min-[360px]:size-24 md:size-28 rounded-[20px]" />
            {meal.photos.length > 1 && (
              <span className="absolute bottom-1.5 right-1.5 h-6 px-2 rounded-full bg-ink/80 text-white text-[11px] font-semibold grid place-items-center">+{meal.photos.length - 1}</span>
            )}
          </button>
        ) : (
          <button onClick={onEdit} className="press size-20 min-[360px]:size-24 md:size-28 rounded-[20px] bg-cream grid place-items-center text-ink/30 shrink-0" aria-label="Adicionar foto">
            <LuCamera size={22} />
          </button>
        )}
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2">
            <span className="min-w-0 truncate h-6 leading-6 px-2.5 rounded-full bg-blush/70 text-orange text-[12px] font-medium">{mealLabel(meal.kind)}</span>
            <span className="shrink-0 text-[13px] text-muted tabular-nums">{meal.time}</span>
            <span className="ml-auto shrink-0 flex -mr-1 -mt-1">
              <IconButton label="Repetir agora" className="size-8" onClick={onRepeat}><LuRepeat size={14} /></IconButton>
              <IconButton label="Editar" className="size-8" onClick={onEdit}><LuPencil size={14} /></IconButton>
            </span>
          </div>
          <p className="text-[15px] md:text-[16px] text-ink mt-2 leading-snug line-clamp-3">{meal.description || <span className="text-muted">Sem descrição</span>}</p>
          {meal.note && <p className="text-[13px] text-muted mt-1.5 line-clamp-2">{meal.note}</p>}
        </div>
      </Card>
    </li>
  );
}

export function Thumb({ id, className }: { id: string; className?: string }) {
  const { url, missing } = usePhoto(id);
  return (
    <div className={cx('bg-cream overflow-hidden grid place-items-center text-ink/30', className)}>
      {url ? <img src={url} alt="Foto da refeição" className="size-full object-cover" draggable={false} />
        : missing ? <LuImageOff size={20} /> : <LuLoaderCircle size={18} className="animate-spin" />}
    </div>
  );
}

/* ── galeria ──────────────────────────────────────────────── */
function Gallery({ onOpen, onEdit }: { onOpen: (ids: string[], i: number) => void; onEdit: (m: MealLog) => void }) {
  const { state } = useStore();
  const withPhotos = useMemo(() => [...(state.meals || [])].filter((m) => m.photos.length)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)), [state.meals]);
  const byDay = useMemo(() => {
    const map = new Map<string, MealLog[]>();
    withPhotos.forEach((m) => map.set(m.date, [...(map.get(m.date) || []), m]));
    return [...map.entries()];
  }, [withPhotos]);

  if (!withPhotos.length)
    return <Card className="p-5"><Empty icon={<LuImages />} title="Nenhuma foto ainda" text="As fotos que você tirar das refeições aparecem aqui, organizadas por dia." /></Card>;

  return (
    <div className="space-y-5">
      {byDay.map(([date, list]) => {
        const all = list.flatMap((m) => m.photos.map((p) => ({ p, m })));
        const ids = all.map((x) => x.p);
        return (
          <section key={date}>
            <p className="text-[15px] font-medium text-ink mb-2.5">{relDay(date)} <span className="text-muted font-normal">· {fmtDayMonth(date)}</span></p>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
              {all.map(({ p, m }, i) => (
                <button key={p} onClick={() => onOpen(ids, i)} onContextMenu={(e) => { e.preventDefault(); onEdit(m); }}
                  className="press relative aspect-square">
                  <Thumb id={p} className="size-full rounded-[18px]" />
                  <span className="absolute left-1.5 bottom-1.5 h-5 px-2 rounded-full bg-surface/90 text-ink text-[10.5px] font-medium grid place-items-center">
                    {mealLabel(m.kind)} · {m.time}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ── visualizador ─────────────────────────────────────────── */
export function PhotoViewer({ ids, index, onClose }: { ids: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const { url } = usePhoto(ids[i]);
  const touch = useRef<number | null>(null);
  const go = (d: number) => setI((x) => (x + d + ids.length) % ids.length);
  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center animate-fade" role="dialog" aria-label="Foto"
      onClick={onClose}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}>
      {url ? <img src={url} alt="Foto da refeição" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        : <LuLoaderCircle size={28} className="animate-spin text-white/60" />}
      <button aria-label="Fechar" onClick={onClose} className="press absolute top-[max(1rem,env(safe-area-inset-top))] right-4 size-11 rounded-full bg-white/15 text-white grid place-items-center"><LuX size={20} /></button>
      {ids.length > 1 && (
        <>
          <button aria-label="Anterior" onClick={(e) => { e.stopPropagation(); go(-1); }} className="press absolute left-3 size-11 rounded-full bg-white/15 text-white grid place-items-center"><LuChevronLeft size={20} /></button>
          <button aria-label="Próxima" onClick={(e) => { e.stopPropagation(); go(1); }} className="press absolute right-3 size-11 rounded-full bg-white/15 text-white grid place-items-center"><LuChevronRight size={20} /></button>
          <span className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] text-white/70 text-[13px] tabular-nums">{i + 1} / {ids.length}</span>
        </>
      )}
    </div>
  );
}

/* ── formulário ───────────────────────────────────────────── */
const MAX_PHOTOS = 4;

function MealModal({ open, meal, day, onClose, onSave, onDelete }: {
  open: boolean; meal?: MealLog; day: string; onClose: () => void; onSave: (m: Omit<MealLog, 'id'>, fav: boolean) => void; onDelete?: () => void;
}) {
  const { state, actions } = useStore();
  const [fav, setFav] = useState(false);
  const [f, setF] = useState<Omit<MealLog, 'id'>>({ date: day, time: nowHHMM(), kind: 'almoco', description: '', photos: [] });
  const [added, setAdded] = useState<string[]>([]); // fotos novas desta edição (para descartar se cancelar)
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const key = open ? meal?.id ?? 'new' : '';
  const [last, setLast] = useState('');
  if (key !== last) {
    setLast(key);
    if (open) {
      const isTodayDay = day === todayKey();
      setF(meal ? { date: meal.date, time: meal.time, kind: meal.kind, description: meal.description, photos: [...meal.photos], note: meal.note }
        : { date: day, time: isTodayDay ? nowHHMM() : '12:00', kind: isTodayDay ? kindForHour(new Date().getHours()) : 'almoco', description: '', photos: [] });
      setAdded([]); setRemoved([]); setErr(''); setFav(false);
    }
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr('');
    try {
      const room = MAX_PHOTOS - f.photos.length;
      const ids: string[] = [];
      for (const file of [...files].slice(0, room)) ids.push(await savePhoto(file));
      setF((x) => ({ ...x, photos: [...x.photos, ...ids] }));
      setAdded((a) => [...a, ...ids]);
      if (files.length > room) setErr(`Máximo de ${MAX_PHOTOS} fotos por refeição.`);
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível salvar a foto.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => { added.forEach((p) => void deletePhoto(p)); onClose(); };
  const save = () => {
    removed.forEach((p) => void deletePhoto(p));
    onSave({ ...f, description: f.description.trim(), note: f.note?.trim() || undefined }, fav);
  };
  const canSave = !busy && (f.description.trim() || f.photos.length);

  return (
    <Modal open={open} onClose={cancel} title={meal ? 'Editar refeição' : 'Registrar refeição'}
      footer={<>
        {onDelete && <div className="mr-auto"><DeleteButton compact={false} onConfirm={onDelete} /></div>}
        <Button variant="ghost" onClick={cancel}>Cancelar</Button>
        <Button variant="primary" disabled={!canSave} onClick={save}>Salvar</Button>
      </>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (canSave) save(); }}>
        {!meal && state.mealFavorites.length > 0 && (
          <div>
            <p className="text-[13px] text-muted mb-2">⭐ Favoritas</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6">
              {state.mealFavorites.map((x) => (
                <span key={x.id} className={cx('shrink-0 inline-flex items-center rounded-full h-10 pl-4 pr-1 text-[13.5px] max-w-[240px]',
                  f.description === x.description ? 'bg-ink text-on-ink' : 'bg-cream text-ink')}>
                  <button type="button" className="truncate" onClick={() => setF({ ...f, kind: x.kind, description: x.description })}>{x.description}</button>
                  <button type="button" aria-label="Remover favorita" onClick={() => actions.removeMealFavorite(x.id)} className="size-8 grid place-items-center opacity-50 shrink-0"><LuX size={13} /></button>
                </span>
              ))}
            </div>
          </div>
        )}
        {/* fotos */}
        <div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          {f.photos.length === 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => camRef.current?.click()} disabled={busy}
                className="press h-32 rounded-[22px] bg-orange text-white flex flex-col items-center justify-center gap-2 text-[15px] font-medium">
                {busy ? <LuLoaderCircle size={26} className="animate-spin" /> : <LuCamera size={26} />} Tirar foto
              </button>
              <button type="button" onClick={() => galRef.current?.click()} disabled={busy}
                className="press h-32 rounded-[22px] bg-cream text-ink flex flex-col items-center justify-center gap-2 text-[15px] font-medium">
                <LuImage size={26} /> Galeria
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {f.photos.map((p) => (
                <div key={p} className="relative aspect-square">
                  <Thumb id={p} className="size-full rounded-[16px]" />
                  <button type="button" aria-label="Remover foto"
                    onClick={() => { setF((x) => ({ ...x, photos: x.photos.filter((y) => y !== p) })); setRemoved((r) => [...r, p]); }}
                    className="press absolute -top-1.5 -right-1.5 size-7 rounded-full bg-ink text-on-ink grid place-items-center shadow"><LuX size={14} /></button>
                </div>
              ))}
              {f.photos.length < MAX_PHOTOS && (
                <>
                  <button type="button" aria-label="Tirar outra foto" onClick={() => camRef.current?.click()} disabled={busy}
                    className="press aspect-square rounded-[16px] bg-orange text-white grid place-items-center">
                    {busy ? <LuLoaderCircle size={20} className="animate-spin" /> : <LuCamera size={20} />}
                  </button>
                  {f.photos.length < MAX_PHOTOS - 1 && (
                    <button type="button" aria-label="Escolher da galeria" onClick={() => galRef.current?.click()} disabled={busy}
                      className="press aspect-square rounded-[16px] bg-cream text-ink grid place-items-center"><LuImage size={20} /></button>
                  )}
                </>
              )}
            </div>
          )}
          {err && <p className="text-[13px] text-orange mt-2">{err}</p>}
        </div>

        {/* tipo */}
        <div>
          <p className="text-[13px] text-muted mb-2">Refeição</p>
          <div className="flex flex-wrap gap-2">
            {MEAL_KINDS.map((k) => (
              <button key={k.id} type="button" onClick={() => setF({ ...f, kind: k.id as MealKind })}
                className={cx('press h-10 px-4 rounded-full text-[14px] font-medium transition-colors',
                  f.kind === k.id ? 'bg-ink text-on-ink' : 'bg-cream text-ink/70')}>
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia"><Input type="date" className="min-w-0 px-3" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value || f.date })} /></Field>
          <Field label="Horário"><Input type="time" className="min-w-0 px-3" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value || f.time })} /></Field>
        </div>

        <Field label="O que você comeu?">
          <TextArea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3}
            placeholder="Ex: arroz, feijão, frango grelhado e salada" />
        </Field>
        <Field label="Observação (opcional)">
          <Input value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ex: comi com pressa, fiquei com fome depois…" />
        </Field>
        {f.description.trim() && !state.mealFavorites.some((x) => x.description.toLowerCase() === f.description.trim().toLowerCase()) && (
          <button type="button" onClick={() => setFav(!fav)} className="flex items-center gap-2.5 text-[14px] text-ink">
            <span className={cx('size-6 rounded-md border-2 grid place-items-center', fav ? 'bg-orange border-orange text-white' : 'border-ink/25')}>{fav && <LuCheck size={14} strokeWidth={3} />}</span>
            Salvar como favorita
          </button>
        )}
      </form>
    </Modal>
  );
}
