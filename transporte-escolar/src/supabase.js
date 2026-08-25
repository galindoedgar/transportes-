import { createClient } from '@supabase/supabase-js'

// ============ TUS CLAVES DE SUPABASE ============
const supabaseUrl = 'https://bqrbwvgnctistwfpteiv.supabase.co'
const supabaseAnonKey = 'sb_publishable_k8kK5o8fxNtV7-I5yKR92w_ty6EWHBW'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============ FUNCIONES PARA GUARDAR Y CARGAR DATOS ============
// IMPORTANTE: se sube todo en LOTE (1 sola llamada por tabla) en vez de
// uno por uno. Esto evita que se corte a medias si cambias de pantalla,
// se bloquea el celular, o el navegador pausa la pestana durante una
// subida larga de muchos registros.

export async function guardarDatos(data) {
  try {
    const errores = [];

    // Choferes
    if (data.drivers.length > 0) {
      const payload = data.drivers.map(d => ({ id: d.id, name: d.name, salary: d.salary || 0 }));
      const { error } = await supabase.from('drivers').upsert(payload);
      if (error) errores.push({ tabla: 'drivers', error });
    }

    // Camiones
    if (data.trucks.length > 0) {
      const payload = data.trucks.map(t => ({ id: t.id, name: t.name, driver_id: t.driverId }));
      const { error } = await supabase.from('trucks').upsert(payload);
      if (error) errores.push({ tabla: 'trucks', error });
    }

    // Cuentas (sin campos de seguro, esa funcion ya no existe)
    if (data.accounts.length > 0) {
      const payload = data.accounts.map(account => ({
        id: account.id,
        family_name: account.familyName,
        kids: account.kids,
        kids_active: account.kidsActive || {},
        truck_id: account.truckId,
        shift: account.shift,
        category: account.category,
        frequency: account.frequency,
        rate: account.rate,
        tipo_servicio: account.tipoServicio,
        family_id: account.familyId || null,
      }));
      const { error } = await supabase.from('accounts').upsert(payload);
      if (error) errores.push({ tabla: 'accounts', error });
    }

    // Pagos
    if (data.payments.length > 0) {
      const payload = data.payments.map(payment => ({
        id: payment.id,
        account_id: payment.accountId,
        period: payment.period,
        amount: payment.amount,
        date: payment.date,
      }));
      const { error } = await supabase.from('payments').upsert(payload);
      if (error) errores.push({ tabla: 'payments', error });
    }

    // Gastos
    if (data.expenses.length > 0) {
      const payload = data.expenses.map(expense => ({
        id: expense.id,
        truck_id: expense.truckId,
        shift: expense.shift || 'GENERAL',
        category: expense.category,
        amount: expense.amount,
        description: expense.desc || '',
        date: expense.date,
      }));
      const { error } = await supabase.from('expenses').upsert(payload);
      if (error) errores.push({ tabla: 'expenses', error });
    }

    if (errores.length > 0) {
      errores.forEach(e => console.error(`Error guardando ${e.tabla}:`, e.error));
      return { success: false, errores };
    }

    return { success: true };
  } catch (error) {
    console.error('Error guardando datos:', error);
    return { success: false, error };
  }
}

export async function cargarDatos() {
  try {
    // Cargar choferes
    const { data: drivers, error: errDrivers } = await supabase.from('drivers').select('*')
    if (errDrivers) throw errDrivers

    // Cargar camiones
    const { data: trucks, error: errTrucks } = await supabase.from('trucks').select('*')
    if (errTrucks) throw errTrucks

    // Cargar cuentas
    const { data: accounts, error: errAccounts } = await supabase.from('accounts').select('*')
    if (errAccounts) throw errAccounts

    // Cargar pagos
    const { data: payments, error: errPayments } = await supabase.from('payments').select('*')
    if (errPayments) throw errPayments

    // Cargar gastos
    const { data: expenses, error: errExpenses } = await supabase.from('expenses').select('*')
    if (errExpenses) throw errExpenses

    // Convertir a formato app.js
    return {
      drivers: drivers.map(d => ({ id: d.id, name: d.name, salary: d.salary || 0 })),
      trucks: trucks.map(t => ({ id: t.id, name: t.name, driverId: t.driver_id })),
      accounts: accounts.map(a => ({
        id: a.id,
        familyName: a.family_name,
        kids: a.kids || [],
        kidsActive: a.kids_active || {},
        truckId: a.truck_id,
        shift: a.shift,
        category: a.category,
        frequency: a.frequency,
        rate: a.rate,
        tipoServicio: a.tipo_servicio,
        familyId: a.family_id || null,
      })),
      payments: payments.map(p => ({
        id: p.id,
        accountId: p.account_id,
        period: p.period,
        amount: p.amount,
        date: p.date,
      })),
      expenses: expenses.map(e => ({
        id: e.id,
        truckId: e.truck_id,
        shift: e.shift || 'GENERAL',
        category: e.category,
        amount: e.amount,
        desc: e.description || '',
        date: e.date,
      })),
    }
  } catch (error) {
    console.error('Error cargando datos:', error)
    return null
  }
}