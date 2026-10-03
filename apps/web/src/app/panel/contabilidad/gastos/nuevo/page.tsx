/**
 * CAPA: Presentation / App — Contabilidad · Registrar gasto (especificación §5.7; administración).
 *
 * Tres bloques numerados: ¿qué pagaste? (sede, concepto, qué fue y monto),
 * ¿cómo pagaste? (medio, número de operación y, solo por banco, otra fecha)
 * y ¿qué comprobante te dieron? La base manda: un gasto en efectivo sale del
 * cajón de hoy y entra en su próximo arqueo; por banco puede ser de hasta 30
 * días atrás. La clave oculta evita registrarlo dos veces.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import type { ConceptoDeCaja } from '@core/application/ports/caja.port';
import type { TipoDeComprobante } from '@core/application/ports/inventario.port';
import { ETIQUETA_DE_MEDIO, MEDIOS_DE_PAGO } from '@core/domain/caja/cobro';
import { sedeDeTrabajo } from '@core/domain/identidad/contexto-de-panel';
import { cajaRepository } from '@infra/config/composition-root';
import { RUTAS_CONTABILIDAD } from '@/lib/rutas';
import { Aviso, CampoDeTexto, CLASE_DE_CAMPO, Etiquetado, GrupoDeOpciones } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { BotonGuardar, FormularioDelPanel } from '@/presentation/panel/Formulario';
import { EncabezadoDePanel, EstadoVacio } from '@/presentation/panel/Piezas';
import { exigirPermiso, exigirPersonal } from '../../../_sesion';
import { registrarGastoAccion } from '../../actions';
import { parametro, sedeDeParametro, type Parametros } from '../../_componentes';

export const metadata: Metadata = { title: 'Registrar gasto' };

const COMPROBANTES: readonly { valor: TipoDeComprobante; etiqueta: string }[] = [
  { valor: 'factura', etiqueta: 'Factura' },
  { valor: 'recibo', etiqueta: 'Recibo' },
  { valor: 'nota_de_venta', etiqueta: 'Nota de venta' },
  { valor: 'sin_comprobante', etiqueta: 'Sin comprobante' },
];

/** Un día de negocio `AAAA-MM-DD` movido `dias` días (a mediodía UTC: sin saltos de zona). */
function diaMovido(fecha: string, dias: number): string {
  const valor = new Date(`${fecha}T12:00:00Z`);
  return Number.isNaN(valor.getTime()) ? fecha : new Date(valor.getTime() + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Conceptos agrupados como los ordena la base (grupo, nombre). */
function porGrupo(conceptos: readonly ConceptoDeCaja[]): readonly { readonly grupo: string; readonly conceptos: readonly ConceptoDeCaja[] }[] {
  const grupos: { grupo: string; conceptos: ConceptoDeCaja[] }[] = [];
  for (const k of conceptos) {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.grupo === k.grupo) ultimo.conceptos.push(k);
    else grupos.push({ grupo: k.grupo, conceptos: [k] });
  }
  return grupos;
}

function Paso({ numero, titulo }: { readonly numero: number; readonly titulo: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold text-estructural">
      <span className="inline-grid size-8 place-items-center rounded-full bg-estructural text-sobre-estructural">{numero}</span>
      {titulo}
    </h2>
  );
}

export default async function RegistrarGasto({ searchParams }: { readonly searchParams: Parametros }) {
  const [lectura, valores] = await Promise.all([exigirPersonal(RUTAS_CONTABILIDAD.gastoNuevo), searchParams]);
  if (lectura.estado !== 'ok') return null;
  const ctx = lectura.contexto;
  exigirPermiso(ctx, 'contabilidad.leer');
  exigirPermiso(ctx, 'contabilidad.gestionar');
  const sede = sedeDeParametro(ctx, parametro(valores, 'sede')) ?? sedeDeTrabajo(ctx)?.id;
  const unaSede = ctx.sedes.length === 1 ? ctx.sedes[0] : undefined;
  const volver = (
    <Link href={RUTAS_CONTABILIDAD.gastos} className="enlace inline-flex min-h-11 items-center gap-1 justify-self-start text-sm">
      <Icono nombre="flechaIzquierda" tamano={16} />
      Gastos
    </Link>
  );

  if (!sede) {
    return (
      <div className="grid gap-6">
        {volver}
        <EstadoVacio frase="Sin sede" detalle="No hay una sede en la que puedas registrar gastos." />
      </div>
    );
  }

  const conceptos = await (await cajaRepository()).conceptos('gasto');

  return (
    <div className="grid gap-6">
      {volver}
      <EncabezadoDePanel
        titulo="Registrar"
        resaltado="gasto"
        descripcion="Copia los datos del comprobante tal cual. Si pagaste en efectivo, sale de la caja de hoy y entra en su próximo cierre."
      />
      {!conceptos.exito ? (
        <Aviso tono="error" titulo="No pudimos cargar los conceptos de gasto">
          <p>{conceptos.error}</p>
        </Aviso>
      ) : conceptos.valor.length === 0 ? (
        <EstadoVacio frase="Sin conceptos de gasto" detalle="No hay conceptos de gasto activos. Hace falta al menos uno para registrar un gasto." />
      ) : (
        <FormularioDelPanel accion={registrarGastoAccion} etiqueta="Registrar un gasto">
          <input type="hidden" name="clave" value={randomUUID()} />
          {unaSede ? <input type="hidden" name="sede" value={unaSede.id} /> : null}

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={1} titulo="¿Qué pagaste?" />
            {unaSede ? null : (
              <GrupoDeOpciones
                nombre="sede"
                leyenda="Sede"
                columnas={ctx.sedes.length > 2 ? 3 : 2}
                valor={sede}
                opciones={ctx.sedes.map((s) => ({ valor: s.id, etiqueta: s.nombre, detalle: s.zona }))}
              />
            )}
            <Etiquetado id="concepto" etiqueta="Concepto">
              <select id="concepto" name="concepto" required defaultValue="" className={CLASE_DE_CAMPO}>
                <option value="">— Elige —</option>
                {porGrupo(conceptos.valor).map((g) => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.conceptos.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nombre}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Etiquetado>
            <CampoDeTexto id="descripcion" etiqueta="¿Qué fue?" minLength={3} maxLength={200} autoComplete="off" placeholder="Por ejemplo: luz de septiembre de la sede" />
            <CampoDeTexto id="monto" etiqueta="Monto (Bs)" inputMode="decimal" autoComplete="off" placeholder="0,00" className="max-w-56 text-right" />
          </section>

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={2} titulo="¿Cómo pagaste?" />
            <GrupoDeOpciones
              nombre="medio"
              leyenda="Medio de pago"
              columnas={3}
              valor="efectivo"
              opciones={MEDIOS_DE_PAGO.map((m) => ({
                valor: m,
                etiqueta: ETIQUETA_DE_MEDIO[m],
                detalle: m === 'efectivo' ? 'Sale de la caja de hoy' : 'Pide el número de operación',
              }))}
            />
            <CampoDeTexto id="referencia" etiqueta="Número de operación" opcional maxLength={60} autoComplete="off" ayuda="Solo para QR o transferencia: el que aparece en el comprobante del banco." />
            <CampoDeTexto
              id="fecha"
              etiqueta="Fecha del pago"
              opcional
              type="date"
              min={diaMovido(ctx.hoy, -30)}
              max={ctx.hoy}
              className="max-w-56"
              ayuda="Solo si pagaste por banco en otro día (hasta 30 días atrás); en efectivo es hoy. Vacío = hoy."
            />
          </section>

          <section className="grid gap-4 rounded-[var(--t-radio-lg)] border border-linea bg-tarjeta p-4 sm:p-5">
            <Paso numero={3} titulo="¿Qué comprobante te dieron?" />
            <GrupoDeOpciones nombre="comprobante" leyenda="Comprobante" columnas={2} valor="sin_comprobante" opciones={COMPROBANTES} />
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoDeTexto id="numeroComprobante" etiqueta="Número del comprobante" opcional maxLength={40} autoComplete="off" />
              <CampoDeTexto id="proveedor" etiqueta="Proveedor" opcional maxLength={120} autoComplete="off" placeholder="Por ejemplo: DELAPAZ" />
            </div>
          </section>

          <div>
            <BotonGuardar icono="recibo" enviando="Guardando gasto…">
              Guardar gasto
            </BotonGuardar>
          </div>
        </FormularioDelPanel>
      )}
    </div>
  );
}
