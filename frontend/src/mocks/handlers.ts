/**
 * MSW Handlers - Mock API endpoints for DEMO mode
 * Covers all application modules and functionality
 */

import { http, HttpResponse } from 'msw';
import { DemoStore } from './demoStore';
import { randDelay, ok, err, parseUrl, paginate, searchItems } from './serverUtils';

// Fixture data inline (to avoid import issues)
const fixtures = {
  users: [
    {
      "id": "demo_admin",
      "email": "admin@demo.com",
      "password": "123456",
      "NOMBRE / APELLIDOS": "Admin Demo",
      "CODIGO": "ADM001",
      "GRUPO": "Admin",
      "role": "ADMIN",
      "isManager": true,
      "centro": "Madrid",
      "telefono": "+34 600 000 001",
      "fechaAlta": "2024-01-01",
      "activo": true
    },
    {
      "id": "demo_supervisor",
      "email": "supervisor@demo.com",
      "password": "123456",
      "NOMBRE / APELLIDOS": "Supervisor Demo",
      "CODIGO": "SUP001",
      "GRUPO": "Supervisor",
      "role": "MANAGER",
      "isManager": true,
      "centro": "Barcelona",
      "telefono": "+34 600 000 002",
      "fechaAlta": "2024-01-15",
      "activo": true
    },
    {
      "id": "demo_manager",
      "email": "manager@demo.com",
      "password": "123456",
      "NOMBRE / APELLIDOS": "Manager Demo",
      "CODIGO": "MGR001",
      "GRUPO": "Manager",
      "role": "MANAGER",
      "isManager": true,
      "centro": "Valencia",
      "telefono": "+34 600 000 003",
      "fechaAlta": "2024-02-01",
      "activo": true
    },
    {
      "id": "demo_empleado",
      "email": "empleado@demo.com",
      "password": "123456",
      "NOMBRE / APELLIDOS": "Empleado Demo",
      "CODIGO": "EMP001",
      "GRUPO": "Empleado",
      "role": "EMPLEADOS",
      "isManager": false,
      "centro": "Madrid",
      "telefono": "+34 600 000 004",
      "fechaAlta": "2024-02-15",
      "activo": true
    }
  ],
  sessions: [
    {
      "id": "session_demo",
      "userId": "demo_admin",
      "token": "demo-token-12345",
      "createdAt": "2024-10-03T10:00:00Z",
      "expiresAt": "2024-10-04T10:00:00Z"
    }
  ],
  empleados: [
    {
      "id": "emp001",
      "CODIGO": "EMP001",
      "NOMBRE / APELLIDOS": "Juan Carlos Demo",
      "email": "juan.carlos@demo.com",
      "GRUPO": "Empleado",
      "role": "EMPLEADOS",
      "centro": "Madrid",
      "telefono": "+34 600 100 001",
      "fechaAlta": "2024-01-15",
      "activo": true
    },
    {
      "id": "emp002",
      "CODIGO": "EMP002",
      "NOMBRE / APELLIDOS": "María García Demo",
      "email": "maria.garcia@demo.com",
      "GRUPO": "Supervisor",
      "role": "MANAGER",
      "centro": "Barcelona",
      "telefono": "+34 600 100 002",
      "fechaAlta": "2024-01-20",
      "activo": true
    }
  ],
  clientes: [
    {
      "id": "cli001",
      "nif": "A12345678",
      "nombre": "Empresa Demo S.L.",
      "direccion": "Calle Mayor 123, Madrid",
      "telefono": "+34 91 123 4567",
      "email": "contacto@empresademo.com",
      "contacto": "Juan Pérez",
      "sector": "Tecnología",
      "fechaAlta": "2024-01-15",
      "activo": true
    }
  ],
  proveedores: [],
  fichajes: [],
  cuadrantes: [],
  nominas: [],
  documentos: [],
  solicitudes: [],
  inspecciones: [],
  estadisticas: {
    "empleados": {
      "total": 2,
      "activos": 2,
      "inactivos": 0
    }
  },
  logs: []
};

DemoStore.init(fixtures);

export const handlers = [
  // Authentication endpoints
  http.get('https://n8n.decaminoservicios.com/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142', async ({ request }) => {
    console.log('🎭 DEMO: Login request intercepted:', request.url);
    
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    const email = qp.email || qp['CORREO ELECTRONICO'];
    const password = qp.password || qp['D.N.I. / NIE'];
    
    console.log('🎭 DEMO: Login attempt:', { email, password: password ? '***' : 'none' });
    
    // Find user
    const users = DemoStore.list('users');
    const user = users.find(u => 
      (u.email === email || u['CORREO ELECTRONICO'] === email) &&
      (u.password === password || u['D.N.I. / NIE'] === password)
    );
    
    if (!user) {
      console.log('🎭 DEMO: Login failed - user not found');
      return err(401, 'Credenciales incorrectas');
    }
    
    console.log('🎭 DEMO: Login successful for:', user.email);
    return ok([user]);
  }),

  // Empleados endpoints
  http.get('/api/empleados', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let empleados = DemoStore.list('empleados');
    
    // Search filter
    if (qp.search) {
      empleados = searchItems(empleados, qp.search, ['NOMBRE / APELLIDOS', 'email', 'centro']);
    }
    
    // Centro filter
    if (qp.centro) {
      empleados = empleados.filter(e => e.centro === qp.centro);
    }
    
    // Pagination
    const page = parseInt(qp.page) || 1;
    const pageSize = parseInt(qp.pageSize) || 20;
    const result = paginate(empleados, page, pageSize);
    
    return ok(result);
  }),

  http.get('/api/empleados/:id', async ({ params }) => {
    await randDelay();
    
    const empleado = DemoStore.get('empleados', params.id);
    if (!empleado) {
      return err(404, 'Empleado no encontrado');
    }
    
    return ok(empleado);
  }),

  http.post('/api/empleados', async ({ request }) => {
    await randDelay();
    
    const newEmpleado = await request.json();
    const created = DemoStore.create('empleados', newEmpleado);
    
    return ok(created);
  }),

  http.patch('/api/empleados/:id', async ({ params, request }) => {
    await randDelay();
    
    const updates = await request.json();
    const updated = DemoStore.update('empleados', params.id, updates);
    
    if (!updated) {
      return err(404, 'Empleado no encontrado');
    }
    
    return ok(updated);
  }),

  http.delete('/api/empleados/:id', async ({ params }) => {
    await randDelay();
    
    const deleted = DemoStore.remove('empleados', params.id);
    if (!deleted) {
      return err(404, 'Empleado no encontrado');
    }
    
    return ok({ success: true });
  }),

  // Clientes endpoints
  http.get('/api/clientes', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let clientes = DemoStore.list('clientes');
    
    if (qp.search) {
      clientes = searchItems(clientes, qp.search, ['nombre', 'nif', 'email']);
    }
    
    const page = parseInt(qp.page) || 1;
    const pageSize = parseInt(qp.pageSize) || 20;
    const result = paginate(clientes, page, pageSize);
    
    return ok(result);
  }),

  http.get('/api/clientes/:nif', async ({ params }) => {
    await randDelay();
    
    const clientes = DemoStore.list('clientes');
    const cliente = clientes.find(c => c.nif === params.nif);
    
    if (!cliente) {
      return err(404, 'Cliente no encontrado');
    }
    
    return ok(cliente);
  }),

  // Proveedores endpoints
  http.get('/api/proveedores', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let proveedores = DemoStore.list('proveedores');
    
    if (qp.search) {
      proveedores = searchItems(proveedores, qp.search, ['nombre', 'nif', 'email']);
    }
    
    const page = parseInt(qp.page) || 1;
    const pageSize = parseInt(qp.pageSize) || 20;
    const result = paginate(proveedores, page, pageSize);
    
    return ok(result);
  }),

  http.get('/api/proveedores/:nif', async ({ params }) => {
    await randDelay();
    
    const proveedores = DemoStore.list('proveedores');
    const proveedor = proveedores.find(p => p.nif === params.nif);
    
    if (!proveedor) {
      return err(404, 'Proveedor no encontrado');
    }
    
    return ok(proveedor);
  }),

  // Fichajes endpoints
  http.get('/api/fichajes', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let fichajes = DemoStore.list('fichajes');
    
    if (qp.empleadoId) {
      fichajes = fichajes.filter(f => f.empleadoId === qp.empleadoId);
    }
    
    if (qp.fecha) {
      fichajes = fichajes.filter(f => f.fecha === qp.fecha);
    }
    
    const page = parseInt(qp.page) || 1;
    const pageSize = parseInt(qp.pageSize) || 20;
    const result = paginate(fichajes, page, pageSize);
    
    return ok(result);
  }),

  http.post('/api/fichajes', async ({ request }) => {
    await randDelay();
    
    const newFichaje = await request.json();
    const created = DemoStore.create('fichajes', newFichaje);
    
    return ok(created);
  }),

  // Cuadrantes endpoints
  http.get('/api/cuadrantes', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let cuadrantes = DemoStore.list('cuadrantes');
    
    if (qp.mes) {
      cuadrantes = cuadrantes.filter(c => c.mes === qp.mes);
    }
    
    if (qp.empleadoId) {
      cuadrantes = cuadrantes.filter(c => c.empleadoId === qp.empleadoId);
    }
    
    return ok(cuadrantes);
  }),

  // Nóminas endpoints
  http.get('/api/nominas', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let nominas = DemoStore.list('nominas');
    
    if (qp.empleadoId) {
      nominas = nominas.filter(n => n.empleadoId === qp.empleadoId);
    }
    
    if (qp.an && qp.luna) {
      const periodo = `${qp.an}-${qp.luna.padStart(2, '0')}`;
      nominas = nominas.filter(n => n.periodo === periodo);
    }
    
    return ok(nominas);
  }),

  http.get('/api/nominas/:id/download', async ({ params }) => {
    await randDelay();
    
    const nomina = DemoStore.get('nominas', params.id);
    if (!nomina) {
      return err(404, 'Nómina no encontrada');
    }
    
    return ok({
      filename: nomina.archivo,
      mime: 'application/pdf',
      contentBase64: nomina.contentBase64
    });
  }),

  // Documentos endpoints
  http.get('/api/documentos', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let documentos = DemoStore.list('documentos');
    
    if (qp.email) {
      documentos = documentos.filter(d => d.empleadoEmail === qp.email);
    }
    
    const page = parseInt(qp.page) || 1;
    const pageSize = parseInt(qp.pageSize) || 20;
    const result = paginate(documentos, page, pageSize);
    
    return ok(result);
  }),

  http.get('/api/documentos/:id/download', async ({ params }) => {
    await randDelay();
    
    const documento = DemoStore.get('documentos', params.id);
    if (!documento) {
      return err(404, 'Documento no encontrado');
    }
    
    return ok({
      filename: documento.archivo,
      mime: 'application/pdf',
      contentBase64: documento.contentBase64
    });
  }),

  http.post('/api/documentos', async ({ request }) => {
    await randDelay();
    
    const newDocumento = await request.json();
    const created = DemoStore.create('documentos', newDocumento);
    
    return ok(created);
  }),

  http.delete('/api/documentos/:id', async ({ params }) => {
    await randDelay();
    
    const deleted = DemoStore.remove('documentos', params.id);
    if (!deleted) {
      return err(404, 'Documento no encontrado');
    }
    
    return ok({ success: true });
  }),

  // Solicitudes endpoints
  http.get('/api/solicitudes', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let solicitudes = DemoStore.list('solicitudes');
    
    if (qp.empleadoId) {
      solicitudes = solicitudes.filter(s => s.empleadoId === qp.empleadoId);
    }
    
    if (qp.tipo) {
      solicitudes = solicitudes.filter(s => s.tipo === qp.tipo);
    }
    
    if (qp.estado) {
      solicitudes = solicitudes.filter(s => s.estado === qp.estado);
    }
    
    const page = parseInt(qp.page) || 1;
    const pageSize = parseInt(qp.pageSize) || 20;
    const result = paginate(solicitudes, page, pageSize);
    
    return ok(result);
  }),

  http.post('/api/solicitudes', async ({ request }) => {
    await randDelay();
    
    const newSolicitud = await request.json();
    const created = DemoStore.create('solicitudes', newSolicitud);
    
    return ok(created);
  }),

  http.patch('/api/solicitudes/:id', async ({ params, request }) => {
    await randDelay();
    
    const updates = await request.json();
    const updated = DemoStore.update('solicitudes', params.id, updates);
    
    if (!updated) {
      return err(404, 'Solicitud no encontrada');
    }
    
    return ok(updated);
  }),

  // Inspecciones endpoints
  http.get('/api/inspecciones', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let inspecciones = DemoStore.list('inspecciones');
    
    if (qp.empleadoId) {
      inspecciones = inspecciones.filter(i => i.empleadoId === qp.empleadoId);
    }
    
    if (qp.tipo) {
      inspecciones = inspecciones.filter(i => i.tipo === qp.tipo);
    }
    
    if (qp.estado) {
      inspecciones = inspecciones.filter(i => i.estado === qp.estado);
    }
    
    const page = parseInt(qp.page) || 1;
    const pageSize = parseInt(qp.pageSize) || 20;
    const result = paginate(inspecciones, page, pageSize);
    
    return ok(result);
  }),

  http.get('/api/inspecciones/:id/download', async ({ params }) => {
    await randDelay();
    
    const inspeccion = DemoStore.get('inspecciones', params.id);
    if (!inspeccion) {
      return err(404, 'Inspección no encontrada');
    }
    
    if (!inspeccion.contentBase64) {
      return err(404, 'Archivo no disponible');
    }
    
    return ok({
      filename: inspeccion.archivo,
      mime: 'application/pdf',
      contentBase64: inspeccion.contentBase64
    });
  }),

  // Estadísticas endpoints
  http.get('/api/estadisticas', async () => {
    await randDelay();
    
    const estadisticas = DemoStore.get('estadisticas', 'general') || DemoStore.list('estadisticas')[0];
    return ok(estadisticas);
  }),

  // Logs endpoints
  http.get('/api/logs', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    let logs = DemoStore.list('logs');
    
    if (qp.usuario) {
      logs = logs.filter(l => l.usuario === qp.usuario);
    }
    
    if (qp.accion) {
      logs = logs.filter(l => l.accion === qp.accion);
    }
    
    if (qp.modulo) {
      logs = logs.filter(l => l.modulo === qp.modulo);
    }
    
    const page = parseInt(qp.page) || 1;
    const pageSize = parseInt(qp.pageSize) || 20;
    const result = paginate(logs, page, pageSize);
    
    return ok(result);
  }),

  http.post('/api/logs', async ({ request }) => {
    await randDelay();
    
    const newLog = await request.json();
    const created = DemoStore.create('logs', newLog);
    
    return ok(created);
  }),

  // Avatar endpoints
  http.post('https://n8n.decaminoservicios.com/webhook/getavatar/886f6dd7-8b4d-479b-85f4-fb888ba8f731', async ({ request }) => {
    await randDelay();
    
    const formData = await request.formData();
    const motivo = formData.get('motivo');
    const codigo = formData.get('CODIGO');
    
    if (motivo === 'get' && codigo) {
      // Simulate avatar data
      const avatarData = {
        AVATAR_B64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        CODIGO: codigo,
        nombre: formData.get('nombre') || 'Demo User'
      };
      
      return ok([avatarData]);
    }
    
    return err(404, 'Avatar no encontrado');
  }),

  // Admin endpoints
  http.get('/api/admin/permissions', async ({ request }) => {
    await randDelay();
    
    const { qp } = parseUrl(request.url);
    const grupoModule = qp.grupo_module;
    
    // Simulate permissions based on grupo
    const permissions = {
      'Admin_inicio': 'true',
      'Admin_empleados': 'true',
      'Admin_fichar': 'true',
      'Admin_cuadrantes': 'true',
      'Admin_estadisticas': 'true',
      'Admin_clientes': 'true',
      'Admin_documentos': 'true',
      'Admin_solicitudes': 'true',
      'Admin_aprobaciones': 'true',
      'Admin_admin': 'true',
      'Manager_inicio': 'true',
      'Manager_empleados': 'true',
      'Manager_fichar': 'true',
      'Manager_cuadrantes': 'true',
      'Manager_estadisticas': 'true',
      'Manager_clientes': 'true',
      'Manager_documentos': 'true',
      'Manager_solicitudes': 'true',
      'Manager_aprobaciones': 'true',
      'Manager_admin': 'false',
      'Supervisor_inicio': 'true',
      'Supervisor_empleados': 'true',
      'Supervisor_fichar': 'true',
      'Supervisor_cuadrantes': 'true',
      'Supervisor_estadisticas': 'true',
      'Supervisor_clientes': 'false',
      'Supervisor_documentos': 'true',
      'Supervisor_solicitudes': 'true',
      'Supervisor_aprobaciones': 'true',
      'Supervisor_admin': 'false',
      'Empleado_inicio': 'true',
      'Empleado_empleados': 'false',
      'Empleado_fichar': 'true',
      'Empleado_cuadrantes': 'false',
      'Empleado_estadisticas': 'false',
      'Empleado_clientes': 'false',
      'Empleado_documentos': 'true',
      'Empleado_solicitudes': 'true',
      'Empleado_aprobaciones': 'false',
      'Empleado_admin': 'false'
    };
    
    if (grupoModule && permissions[grupoModule]) {
      return ok([{
        grupo_module: grupoModule,
        permitted: permissions[grupoModule]
      }]);
    }
    
    // Return all permissions for the grupo
    const grupo = grupoModule?.split('_')[0];
    const grupoPermissions = Object.entries(permissions)
      .filter(([key]) => key.startsWith(grupo + '_'))
      .map(([key, value]) => ({
        grupo_module: key,
        permitted: value
      }));
    
    return ok(grupoPermissions);
  }),

  // Error simulation endpoint
  http.all('/api/*', async ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('forceError') === 'true') {
      return err(500, 'Error simulado para testing');
    }
    
    // Default 404 for unmatched routes
    return err(404, 'Endpoint no encontrado en modo DEMO');
  })
];
