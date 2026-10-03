/**
 * CAPA: Presentation / App — campos del artículo (alta y edición).
 *
 * El tipo se elige antes (con enlaces), así cada formulario muestra solo lo
 * que ese tipo usa: el vencimiento en insumos, el precio y las tallas en
 * uniformes. El icono se elige mirando el dibujo, no un nombre.
 */

import type { ArticuloConExistencias } from '@core/application/ports/inventario.port';
import { ICONOS_DE_ARTICULO, UNIDADES, type TipoDeArticulo } from '@core/domain/inventario/articulo';
import { montoParaCampo } from '@core/domain/shared/dinero';
import { CampoDeTexto, CLASE_DE_CAMPO, Etiquetado } from '@/presentation/formularios/Campos';
import { Icono } from '@/presentation/icons/Icono';
import { cantidadParaCampo, ICONO_DE_TIPO } from './_componentes';

const NOMBRE_DE_UNIDAD: Record<(typeof UNIDADES)[number], string> = {
  unidad: 'Unidad (pieza)',
  kg: 'Kilogramo (kg)',
  g: 'Gramo (g)',
  l: 'Litro (l)',
  ml: 'Mililitro (ml)',
  paquete: 'Paquete',
};

const NOMBRE_DE_DIBUJO: Record<(typeof ICONOS_DE_ARTICULO)[number], string> = {
  trigo: 'Trigo',
  huevo: 'Huevo',
  lacteo: 'Lácteo',
  torta: 'Torta',
  copa: 'Copa',
  plato: 'Plato',
  chaqueta: 'Chaqueta',
  gorro: 'Gorro',
  cubiertos: 'Cubiertos',
  bol: 'Bol',
  batidor: 'Batidor',
  almacen: 'Almacén',
  paquete: 'Paquete',
};

export function CamposDeArticulo({ tipo, articulo }: { readonly tipo: TipoDeArticulo; readonly articulo?: ArticuloConExistencias }) {
  const unidades = tipo === 'uniforme' || tipo === 'utensilio' ? UNIDADES.filter((u) => u === 'unidad' || u === 'paquete') : UNIDADES;
  const iconoActual = articulo?.icono ?? ICONO_DE_TIPO[tipo];
  return (
    <>
      <CampoDeTexto id="nombre" etiqueta="Nombre" maxLength={80} autoComplete="off" defaultValue={articulo?.nombre} placeholder={tipo === 'insumo' ? 'Harina de trigo' : tipo === 'uniforme' ? 'Juego de uniforme' : tipo === 'utensilio' ? 'Juego de cuchillos' : 'Detergente'} />
      <div className="grid gap-4 sm:grid-cols-2">
        {articulo ? (
          <Etiquetado id="unidad-fija" etiqueta="Se cuenta en">
            <p id="unidad-fija" className="py-3 font-semibold text-tinta">
              {NOMBRE_DE_UNIDAD[articulo.unidad]}
            </p>
          </Etiquetado>
        ) : (
          <Etiquetado id="unidad" etiqueta="Se cuenta en" ayuda={tipo === 'insumo' || tipo === 'otro' ? 'En kg, g, l o ml se admiten decimales (2,5 kg).' : 'Por piezas enteras.'}>
            <select id="unidad" name="unidad" className={CLASE_DE_CAMPO} defaultValue={tipo === 'insumo' ? 'kg' : 'unidad'}>
              {unidades.map((u) => (
                <option key={u} value={u}>
                  {NOMBRE_DE_UNIDAD[u]}
                </option>
              ))}
            </select>
          </Etiquetado>
        )}
        <CampoDeTexto id="categoria" etiqueta="Categoría" opcional maxLength={40} autoComplete="off" defaultValue={articulo?.categoria ?? ''} placeholder={tipo === 'insumo' ? 'Harinas, lácteos…' : ''} />
      </div>
      <CampoDeTexto
        id="stockMinimo"
        etiqueta="Avísame cuando queden menos de"
        opcional
        inputMode="decimal"
        autoComplete="off"
        defaultValue={articulo && articulo.stockMinimo > 0n ? cantidadParaCampo(articulo.stockMinimo) : ''}
        ayuda="Vale para cada sede. Vacío: sin aviso."
        className="max-w-48"
      />
      {tipo === 'insumo' ? (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-2 border-linea bg-tarjeta p-3 has-[:checked]:border-estructural">
          <input type="checkbox" name="controlaVencimiento" value="si" defaultChecked={articulo ? articulo.controlaVencimiento : true} className="size-5 accent-[var(--t-estructural)]" />
          <span>
            <span className="block font-semibold text-tinta">Vence</span>
            <span className="text-sm text-tinta-suave">Cada compra pedirá su fecha de vencimiento.</span>
          </span>
        </label>
      ) : null}
      {tipo === 'uniforme' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoDeTexto
            id="precioVenta"
            etiqueta="Precio de venta (Bs)"
            opcional
            inputMode="decimal"
            autoComplete="off"
            defaultValue={articulo?.precioVenta ? montoParaCampo(articulo.precioVenta) : ''}
            ayuda="Vacío: «Precio por definir» (se entrega sin cargo)."
          />
          {!articulo ? <CampoDeTexto id="tallas" etiqueta="Tallas" opcional maxLength={120} autoComplete="off" defaultValue="S, M, L, XL" ayuda="Separadas por comas." /> : null}
        </div>
      ) : null}
      <fieldset>
        <legend className="mb-2 font-semibold text-tinta">Dibujo</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {ICONOS_DE_ARTICULO.map((i) => (
            <label
              key={i}
              className="grid min-h-14 cursor-pointer place-items-center rounded-md border-2 border-linea bg-tarjeta text-estructural hover:border-estructural/40 has-[:checked]:border-estructural has-[:checked]:bg-superficie-alterna has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accion/60"
            >
              <input type="radio" name="icono" value={i} defaultChecked={i === iconoActual} className="sr-only" />
              <Icono nombre={i} tamano={26} titulo={NOMBRE_DE_DIBUJO[i]} />
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
