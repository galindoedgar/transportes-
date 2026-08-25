import { createClient } from '@supabase/supabase-js'

// ============ CLAVES DEL NUEVO CLIENTE ============
const supabaseUrl = 'https://lxdrvydupayligrkioke.supabase.co'
const supabaseAnonKey = 'sb_publishable_53XxbYQFzoLL2mnM9SLqbg_cn874C1l'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============ FUNCIONES PARA GUARDAR Y CARGAR DATOS ============

export async function guardarDatos(data) {
  try {
    // Guardar choferes
    for (const driver of data.drivers) {
      const { error } = await supabase
        .from('drivers')
        .upsert({ id: driver.id, name: driver.name, salary: driver.salary || 0 })
      if (error) console.error('Error guardando driver:', error)
    }

    // Guardar camiones
    for (const truck of data.trucks) {
      const { error } = await supabase
        .from('trucks')
        .upsert({ id: truck.id, name: truck.name, driver_id: truck.driverId })
      if (error) console.error('Error guardando truck:', error)
    }

    // Guardar cuentas
    for (const account of data.accounts) {
      const { error } = await supabase
        .from('accounts')
        .upsert({
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
        })
      if (error) console.error('Error guardando account:', error)
    }

    // Guardar pagos
    for (const payment of data.payments) {
      const { error } = await supabase
        .from('payments')
        .upsert({
          id: payment.id,
          account_id: payment.accountId,
          period: payment.period,
          amount: payment.amount,
          date: payment.date,
        })
      if (error) console.error('Error guardando payment:', error)
    }

    // Guardar gastos
    for (const expense of data.expenses) {
      const { error } = await supabase
        .from('expenses')
        .upsert({
          id: expense.id,
          truck_id: expense.truckId,
          shift: expense.shift || 'GENERAL',
          category: expense.category,
          amount: expense.amount,
          description: expense.desc || '',
          date: expense.date,
        })
      if (error) console.error('Error guardando expense:', error)
    }

    return { success: true }
  } catch (error) {
    console.error('Error guardando datos:', error)
    return { success: false, error }
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