const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'assembly_inspector',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Starting database seed...');

    // Drop tables in dependency order
    await client.query(`
      DROP TABLE IF EXISTS work_orders CASCADE;
      DROP TABLE IF EXISTS quality_goals CASCADE;
      DROP TABLE IF EXISTS training_records CASCADE;
      DROP TABLE IF EXISTS inventory CASCADE;
      DROP TABLE IF EXISTS audit_trail CASCADE;
      DROP TABLE IF EXISTS maintenance_schedules CASCADE;
      DROP TABLE IF EXISTS downtime_events CASCADE;
      DROP TABLE IF EXISTS shifts CASCADE;
      DROP TABLE IF EXISTS reports CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS inspections CASCADE;
      DROP TABLE IF EXISTS batches CASCADE;
      DROP TABLE IF EXISTS camera_feeds CASCADE;
      DROP TABLE IF EXISTS defect_library CASCADE;
      DROP TABLE IF EXISTS operators CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS production_lines CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    console.log('Dropped existing tables.');

    // Create tables
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'operator',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE production_lines (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        speed_units_per_hour INTEGER,
        product_type VARCHAR(255),
        last_maintenance TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE camera_feeds (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        position VARCHAR(255),
        resolution VARCHAR(50),
        fps INTEGER,
        status VARCHAR(50) DEFAULT 'online',
        stream_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) UNIQUE,
        category VARCHAR(100),
        description TEXT,
        specifications JSONB DEFAULT '{}',
        quality_threshold NUMERIC(5,2) DEFAULT 95.00,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE defect_library (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE,
        category VARCHAR(50),
        severity VARCHAR(50),
        description TEXT,
        detection_method VARCHAR(255),
        corrective_action TEXT,
        reference_image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE operators (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        employee_id VARCHAR(50) UNIQUE,
        email VARCHAR(255),
        shift VARCHAR(50),
        role VARCHAR(50) DEFAULT 'inspector',
        certification_level VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE batches (
        id SERIAL PRIMARY KEY,
        batch_number VARCHAR(100) UNIQUE NOT NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        quantity INTEGER DEFAULT 0,
        inspected_count INTEGER DEFAULT 0,
        pass_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'in_progress',
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE inspections (
        id SERIAL PRIMARY KEY,
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        camera_feed_id INTEGER REFERENCES camera_feeds(id) ON DELETE SET NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
        operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'pass',
        defect_count INTEGER DEFAULT 0,
        defect_types JSONB DEFAULT '[]',
        confidence_score NUMERIC(5,4),
        ai_analysis JSONB DEFAULT '{}',
        image_url VARCHAR(500),
        inspected_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        type VARCHAR(100),
        severity VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE reports (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        date_from TIMESTAMP,
        date_to TIMESTAMP,
        data JSONB DEFAULT '{}',
        generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE shifts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        start_time TIME,
        end_time TIME,
        operator_ids JSONB DEFAULT '[]',
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE downtime_events (
        id SERIAL PRIMARY KEY,
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        reason VARCHAR(50) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration_minutes INTEGER,
        description TEXT,
        impact TEXT,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE maintenance_schedules (
        id SERIAL PRIMARY KEY,
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(50) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'scheduled',
        assigned_to TEXT,
        scheduled_date DATE,
        completed_date DATE,
        estimated_duration_hours NUMERIC(6,2),
        actual_duration_hours NUMERIC(6,2),
        parts_required JSONB DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE audit_trail (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        details JSONB DEFAULT '{}',
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE inventory (
        id SERIAL PRIMARY KEY,
        part_name VARCHAR(255) NOT NULL,
        part_number VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(50),
        quantity_in_stock INTEGER DEFAULT 0,
        minimum_stock_level INTEGER DEFAULT 0,
        unit_cost NUMERIC(10,2),
        supplier VARCHAR(255),
        location VARCHAR(255),
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'in_stock',
        last_restocked TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE training_records (
        id SERIAL PRIMARY KEY,
        operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
        training_type VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        trainer VARCHAR(255),
        certification_name VARCHAR(255),
        certification_number VARCHAR(100),
        start_date DATE,
        completion_date DATE,
        expiry_date DATE,
        status VARCHAR(50) DEFAULT 'scheduled',
        score NUMERIC(5,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE quality_goals (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        target_value NUMERIC(10,2) NOT NULL,
        current_value NUMERIC(10,2) DEFAULT 0,
        unit VARCHAR(50),
        category VARCHAR(50),
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        start_date DATE,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE work_orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'production',
        priority VARCHAR(50) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'pending',
        production_line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        assigned_to VARCHAR(255),
        quantity_ordered INTEGER DEFAULT 0,
        quantity_completed INTEGER DEFAULT 0,
        due_date DATE,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Created all tables.');

    // Seed Users
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('password123', 10);

    await client.query(`
      INSERT INTO users (name, email, password, role) VALUES
        ('Admin User', 'admin@inspector.com', $1, 'admin'),
        ('Sarah Chen', 'sarah.chen@inspector.com', $2, 'supervisor'),
        ('Marcus Johnson', 'marcus.j@inspector.com', $2, 'operator');
    `, [adminHash, userHash]);
    console.log('Seeded users.');

    // Seed Production Lines
    await client.query(`
      INSERT INTO production_lines (name, location, status, speed_units_per_hour, product_type, last_maintenance) VALUES
        ('SMT Line Alpha', 'Building A - Floor 1', 'active', 1200, 'PCB Assembly', '2026-03-15 08:00:00'),
        ('SMT Line Beta', 'Building A - Floor 1', 'active', 1100, 'PCB Assembly', '2026-03-10 08:00:00'),
        ('Final Assembly Line 1', 'Building A - Floor 2', 'active', 450, 'Electronic Modules', '2026-03-12 14:00:00'),
        ('Final Assembly Line 2', 'Building A - Floor 2', 'maintenance', 420, 'Electronic Modules', '2026-03-18 10:00:00'),
        ('CNC Machining Cell A', 'Building B - Bay 1', 'active', 80, 'Precision Metal Parts', '2026-03-08 06:00:00'),
        ('CNC Machining Cell B', 'Building B - Bay 2', 'active', 75, 'Precision Metal Parts', '2026-03-05 06:00:00'),
        ('Injection Molding Line 1', 'Building C - Section 1', 'active', 600, 'Plastic Housings', '2026-03-14 08:00:00'),
        ('Injection Molding Line 2', 'Building C - Section 2', 'inactive', 580, 'Plastic Housings', '2026-02-28 08:00:00'),
        ('Paint & Coating Line', 'Building D - Paint Shop', 'active', 200, 'Surface Finishing', '2026-03-16 12:00:00'),
        ('Welding Robot Cell 1', 'Building B - Bay 3', 'active', 150, 'Metal Frames', '2026-03-11 10:00:00'),
        ('Welding Robot Cell 2', 'Building B - Bay 4', 'active', 145, 'Metal Frames', '2026-03-09 10:00:00'),
        ('Packaging Line A', 'Building E - Shipping', 'active', 800, 'Finished Goods', '2026-03-13 07:00:00'),
        ('Packaging Line B', 'Building E - Shipping', 'active', 750, 'Finished Goods', '2026-03-07 07:00:00'),
        ('Testing & Validation Bay', 'Building A - Floor 3', 'active', 300, 'Quality Testing', '2026-03-17 09:00:00'),
        ('Wire Harness Assembly', 'Building F - Section 1', 'active', 250, 'Wire Harnesses', '2026-03-06 08:00:00');
    `);
    console.log('Seeded production lines.');

    // Seed Camera Feeds
    await client.query(`
      INSERT INTO camera_feeds (name, production_line_id, position, resolution, fps, status, stream_url) VALUES
        ('SMT-A Solder Paste Inspector', 1, 'Post-Stencil Print', '4K', 30, 'online', 'rtsp://192.168.1.101:554/stream1'),
        ('SMT-A Component Placement Cam', 1, 'Pick-and-Place Exit', '4K', 60, 'online', 'rtsp://192.168.1.102:554/stream1'),
        ('SMT-A Reflow Oven Exit', 1, 'Post-Reflow', '1080p', 30, 'online', 'rtsp://192.168.1.103:554/stream1'),
        ('SMT-B AOI Camera', 2, 'Automated Optical Inspection', '4K', 60, 'online', 'rtsp://192.168.1.104:554/stream1'),
        ('Assembly-1 Top View', 3, 'Assembly Station Overhead', '4K', 30, 'online', 'rtsp://192.168.1.105:554/stream1'),
        ('Assembly-1 Side View', 3, 'Assembly Station Lateral', '1080p', 30, 'online', 'rtsp://192.168.1.106:554/stream1'),
        ('Assembly-2 Inspection Cam', 4, 'End-of-Line Check', '4K', 30, 'offline', 'rtsp://192.168.1.107:554/stream1'),
        ('CNC-A Tool Monitor', 5, 'Spindle Area', '1080p', 60, 'online', 'rtsp://192.168.1.108:554/stream1'),
        ('CNC-A Part Inspector', 5, 'Output Conveyor', '4K', 30, 'online', 'rtsp://192.168.1.109:554/stream1'),
        ('Mold-1 Ejection Cam', 7, 'Mold Ejection Zone', '1080p', 120, 'online', 'rtsp://192.168.1.110:554/stream1'),
        ('Paint Line UV Scanner', 9, 'Post-Cure UV Station', '4K', 30, 'online', 'rtsp://192.168.1.111:554/stream1'),
        ('Weld Cell-1 Arc Monitor', 10, 'Welding Zone', '1080p', 60, 'online', 'rtsp://192.168.1.112:554/stream1'),
        ('Packaging-A Label Verify', 12, 'Label Application', '1080p', 30, 'online', 'rtsp://192.168.1.113:554/stream1'),
        ('Test Bay Thermal Cam', 14, 'Thermal Testing Station', '640x480', 30, 'error', 'rtsp://192.168.1.114:554/stream1'),
        ('Wire Harness Continuity', 15, 'Continuity Test Fixture', '1080p', 30, 'online', 'rtsp://192.168.1.115:554/stream1');
    `);
    console.log('Seeded camera feeds.');

    // Seed Products
    await client.query(`
      INSERT INTO products (name, sku, category, description, specifications, quality_threshold) VALUES
        ('ECU Controller Board v3.2', 'ECU-3200-A', 'Electronics', 'Engine control unit main PCB assembly', '{"layers": 8, "dimensions_mm": "120x80x1.6", "components": 342, "solder_joints": 1284}', 99.50),
        ('Power Inverter Module', 'PWR-INV-500', 'Electronics', 'High-voltage power inverter for EV drivetrain', '{"voltage_rating": "800V", "current_rating": "400A", "dimensions_mm": "250x180x45"}', 99.80),
        ('Aluminum Brake Caliper Housing', 'BRK-CAL-A7', 'Machined Parts', 'CNC machined brake caliper from A356 aluminum', '{"material": "A356-T6", "weight_kg": 2.8, "tolerance_mm": 0.02}', 99.90),
        ('Dashboard Bezel Assembly', 'DSH-BZL-100', 'Plastic Components', 'Injection molded ABS dashboard bezel with soft-touch coating', '{"material": "ABS+PC", "color": "Obsidian Black", "surface_finish": "soft-touch"}', 98.00),
        ('HVAC Blower Motor', 'HVC-BLR-220', 'Electromechanical', 'Brushless DC blower motor for climate control', '{"voltage": "12V", "rpm": 4500, "noise_db": 42}', 99.00),
        ('LED Headlamp Module', 'LED-HLM-900', 'Lighting', 'Adaptive LED headlamp with matrix beam', '{"lumens": 3200, "color_temp_k": 6000, "beam_pattern": "matrix"}', 99.50),
        ('Transmission Gear Set', 'TRN-GR-6SP', 'Machined Parts', '6-speed transmission helical gear set', '{"material": "20MnCr5", "module": 2.5, "teeth": [23,35,28,31,19,42]}', 99.95),
        ('Battery Management PCB', 'BAT-MGT-48', 'Electronics', '48-cell battery management system board', '{"cells_monitored": 48, "balancing": "active", "communication": "CAN-FD"}', 99.70),
        ('Steering Column Shroud', 'STR-SHR-200', 'Plastic Components', 'Two-piece steering column cover with integrated airbag emblem', '{"material": "PP+GF20", "uv_stabilized": true}', 97.50),
        ('Fuel Injector Nozzle', 'FUL-INJ-350', 'Precision Parts', 'Direct injection fuel nozzle with 6-hole spray pattern', '{"holes": 6, "flow_rate_cc_min": 350, "pressure_bar": 350}', 99.99),
        ('Wire Harness Main Body', 'WHR-MBD-001', 'Wiring', 'Main body wiring harness with 48 connectors', '{"circuits": 156, "connectors": 48, "length_m": 12.5}', 99.50),
        ('Exhaust Manifold', 'EXH-MNF-V6', 'Cast Parts', 'Stainless steel exhaust manifold for V6 engine', '{"material": "SS304", "runners": 6, "flange_type": "V-band"}', 99.00),
        ('Instrument Cluster Lens', 'ICL-LNS-400', 'Plastic Components', 'Anti-glare polycarbonate instrument cluster lens', '{"material": "PC", "coating": "AR+HC", "transmission": "92%"}', 98.50),
        ('Electric Window Regulator', 'EWR-FRT-L01', 'Electromechanical', 'Front-left power window regulator with motor', '{"force_n": 75, "speed_mm_s": 50, "cycles": 30000}', 99.00),
        ('Coolant Temperature Sensor', 'CTS-NTC-300', 'Sensors', 'NTC thermistor coolant temperature sensor', '{"range_c": "-40 to 150", "response_ms": 500, "accuracy_c": 1.5}', 99.80);
    `);
    console.log('Seeded products.');

    // Seed Defect Library
    await client.query(`
      INSERT INTO defect_library (name, code, category, severity, description, detection_method, corrective_action, reference_image_url) VALUES
        ('Solder Bridge', 'DEF-SB-001', 'surface', 'critical', 'Unintended solder connection between adjacent pads or leads causing short circuit', 'Automated Optical Inspection (AOI)', 'Rework with solder wick or hot air; adjust stencil aperture ratio', '/references/solder-bridge.jpg'),
        ('Tombstoning', 'DEF-TS-002', 'structural', 'major', 'Component stands up on one end during reflow due to uneven pad wetting', 'AOI with side-angle camera', 'Adjust reflow profile; verify pad design symmetry; check paste deposit volumes', '/references/tombstoning.jpg'),
        ('Surface Scratch', 'DEF-SC-003', 'cosmetic', 'minor', 'Visible scratch on painted or coated surface exceeding 0.5mm width', 'Machine vision with angled lighting', 'Touch-up paint application; review handling procedures', '/references/surface-scratch.jpg'),
        ('Dimensional Out-of-Tolerance', 'DEF-DT-004', 'dimensional', 'critical', 'Part dimension exceeds specified tolerance band', 'CMM measurement or laser scanning', 'Tool wear compensation; replace worn tooling; verify CNC program offsets', '/references/dimensional-oot.jpg'),
        ('Cold Solder Joint', 'DEF-CS-005', 'structural', 'major', 'Solder joint with dull, grainy appearance indicating poor metallurgical bond', 'X-ray inspection and visual AOI', 'Rework joint; check reflow oven temperature profile calibration', '/references/cold-solder.jpg'),
        ('Flash (Molding)', 'DEF-FL-006', 'dimensional', 'minor', 'Excess material along mold parting line exceeding 0.3mm', 'Machine vision edge detection', 'Increase clamp force; inspect mold parting surfaces for wear; deflash', '/references/flash-molding.jpg'),
        ('Void in Solder', 'DEF-VS-007', 'structural', 'major', 'Air pocket within solder joint exceeding 25% of pad area', 'X-ray inspection', 'Optimize reflow profile; adjust paste flux activity; improve pad design', '/references/void-solder.jpg'),
        ('Paint Orange Peel', 'DEF-OP-008', 'cosmetic', 'minor', 'Uneven paint texture resembling orange skin surface', 'Gloss meter and visual inspection', 'Adjust spray gun settings; verify paint viscosity and booth temperature', '/references/orange-peel.jpg'),
        ('Weld Porosity', 'DEF-WP-009', 'structural', 'critical', 'Gas pockets in weld bead reducing joint strength below specification', 'X-ray and ultrasonic testing', 'Check shielding gas flow; clean base material; adjust welding parameters', '/references/weld-porosity.jpg'),
        ('Missing Component', 'DEF-MC-010', 'functional', 'critical', 'Required component absent from assembly', 'AOI component presence detection', 'Place missing component; check feeder status and pick-and-place nozzle', '/references/missing-component.jpg'),
        ('Burr (Machining)', 'DEF-BR-011', 'surface', 'minor', 'Sharp edge or raised material remaining after machining operation', 'Machine vision edge analysis', 'Add deburring operation; replace worn cutting tool; adjust feed rate', '/references/burr-machining.jpg'),
        ('Connector Pin Misalignment', 'DEF-PM-012', 'dimensional', 'major', 'Connector pins bent or offset from nominal position', 'Pin gauge and vision system', 'Straighten pins if within spec; replace connector; review insertion process', '/references/pin-misalignment.jpg'),
        ('Label Misprint', 'DEF-LM-013', 'cosmetic', 'minor', 'Product label has incorrect, smudged, or missing printed information', 'OCR vision verification', 'Reprint and apply correct label; check printer head and ribbon', '/references/label-misprint.jpg'),
        ('Crack in Housing', 'DEF-CH-014', 'structural', 'critical', 'Visible crack in plastic or metal housing compromising structural integrity', 'Machine vision with backlighting', 'Scrap part; investigate mold condition or material batch; adjust process', '/references/crack-housing.jpg'),
        ('Insufficient Solder', 'DEF-IS-015', 'surface', 'major', 'Solder volume below minimum fill requirement for joint specification', 'AOI solder volume measurement', 'Rework joint; check stencil condition; verify paste deposit volume', '/references/insufficient-solder.jpg');
    `);
    console.log('Seeded defect library.');

    // Seed Operators
    await client.query(`
      INSERT INTO operators (name, employee_id, email, shift, role, certification_level, status) VALUES
        ('James Rodriguez', 'EMP-1001', 'j.rodriguez@factory.com', 'Morning', 'inspector', 'Level 3 - Senior', 'active'),
        ('Emily Watson', 'EMP-1002', 'e.watson@factory.com', 'Morning', 'supervisor', 'Level 4 - Lead', 'active'),
        ('David Kim', 'EMP-1003', 'd.kim@factory.com', 'Morning', 'inspector', 'Level 2 - Intermediate', 'active'),
        ('Lisa Patel', 'EMP-1004', 'l.patel@factory.com', 'Afternoon', 'inspector', 'Level 3 - Senior', 'active'),
        ('Robert Zhang', 'EMP-1005', 'r.zhang@factory.com', 'Afternoon', 'engineer', 'Level 4 - Lead', 'active'),
        ('Maria Gonzalez', 'EMP-1006', 'm.gonzalez@factory.com', 'Afternoon', 'inspector', 'Level 2 - Intermediate', 'active'),
        ('Thomas Anderson', 'EMP-1007', 't.anderson@factory.com', 'Night', 'supervisor', 'Level 4 - Lead', 'active'),
        ('Aisha Mohammed', 'EMP-1008', 'a.mohammed@factory.com', 'Night', 'inspector', 'Level 3 - Senior', 'active'),
        ('Kevin OBrien', 'EMP-1009', 'k.obrien@factory.com', 'Night', 'inspector', 'Level 1 - Basic', 'active'),
        ('Yuki Tanaka', 'EMP-1010', 'y.tanaka@factory.com', 'Morning', 'engineer', 'Level 4 - Lead', 'active'),
        ('Carlos Rivera', 'EMP-1011', 'c.rivera@factory.com', 'Morning', 'inspector', 'Level 2 - Intermediate', 'active'),
        ('Sophie Martin', 'EMP-1012', 's.martin@factory.com', 'Afternoon', 'inspector', 'Level 3 - Senior', 'active'),
        ('Hassan Ali', 'EMP-1013', 'h.ali@factory.com', 'Afternoon', 'supervisor', 'Level 4 - Lead', 'active'),
        ('Nina Petrov', 'EMP-1014', 'n.petrov@factory.com', 'Night', 'inspector', 'Level 2 - Intermediate', 'active'),
        ('Michael Chang', 'EMP-1015', 'm.chang@factory.com', 'Night', 'engineer', 'Level 3 - Senior', 'inactive');
    `);
    console.log('Seeded operators.');

    // Seed Batches
    await client.query(`
      INSERT INTO batches (batch_number, product_id, production_line_id, quantity, inspected_count, pass_count, fail_count, status, started_at, completed_at) VALUES
        ('BATCH-2026-0301-001', 1, 1, 500, 500, 496, 4, 'completed', '2026-03-01 06:00:00', '2026-03-01 14:30:00'),
        ('BATCH-2026-0302-001', 2, 2, 200, 200, 199, 1, 'completed', '2026-03-02 06:00:00', '2026-03-02 12:00:00'),
        ('BATCH-2026-0305-001', 3, 5, 150, 150, 149, 1, 'completed', '2026-03-05 07:00:00', '2026-03-05 18:00:00'),
        ('BATCH-2026-0307-001', 4, 7, 1000, 1000, 985, 15, 'completed', '2026-03-07 06:00:00', '2026-03-07 15:00:00'),
        ('BATCH-2026-0308-001', 5, 3, 300, 300, 297, 3, 'completed', '2026-03-08 06:00:00', '2026-03-08 16:00:00'),
        ('BATCH-2026-0310-001', 6, 3, 250, 250, 248, 2, 'completed', '2026-03-10 06:00:00', '2026-03-10 14:00:00'),
        ('BATCH-2026-0312-001', 7, 6, 100, 100, 100, 0, 'completed', '2026-03-12 07:00:00', '2026-03-12 19:00:00'),
        ('BATCH-2026-0313-001', 8, 1, 400, 400, 394, 6, 'completed', '2026-03-13 06:00:00', '2026-03-13 14:00:00'),
        ('BATCH-2026-0314-001', 10, 5, 2000, 2000, 1998, 2, 'completed', '2026-03-14 06:00:00', '2026-03-15 02:00:00'),
        ('BATCH-2026-0315-001', 11, 15, 50, 50, 49, 1, 'completed', '2026-03-15 08:00:00', '2026-03-15 16:00:00'),
        ('BATCH-2026-0316-001', 12, 10, 80, 80, 78, 2, 'completed', '2026-03-16 07:00:00', '2026-03-16 17:00:00'),
        ('BATCH-2026-0317-001', 1, 1, 500, 350, 347, 3, 'in_progress', '2026-03-17 06:00:00', NULL),
        ('BATCH-2026-0318-001', 4, 7, 1000, 620, 608, 12, 'in_progress', '2026-03-18 06:00:00', NULL),
        ('BATCH-2026-0319-001', 9, 7, 800, 0, 0, 0, 'on_hold', '2026-03-19 06:00:00', NULL),
        ('BATCH-2026-0320-001', 14, 3, 400, 120, 119, 1, 'in_progress', '2026-03-20 06:00:00', NULL);
    `);
    console.log('Seeded batches.');

    // Seed Inspections (20 realistic inspections)
    await client.query(`
      INSERT INTO inspections (production_line_id, camera_feed_id, product_id, batch_id, operator_id, status, defect_count, defect_types, confidence_score, ai_analysis, image_url, inspected_at) VALUES
        (1, 1, 1, 1, 1, 'pass', 0, '[]', 0.9850, '{"result": "No defects detected", "areas_checked": ["solder paste alignment", "component placement", "pcb surface"]}', '/uploads/insp-001.jpg', '2026-03-01 08:15:00'),
        (1, 2, 1, 1, 1, 'fail', 2, '["DEF-SB-001", "DEF-MC-010"]', 0.9720, '{"result": "Solder bridge on U12 and missing capacitor C45", "severity": "critical"}', '/uploads/insp-002.jpg', '2026-03-01 08:32:00'),
        (1, 3, 1, 1, 3, 'pass', 0, '[]', 0.9910, '{"result": "Reflow profile nominal, all joints acceptable"}', '/uploads/insp-003.jpg', '2026-03-01 09:10:00'),
        (2, 4, 2, 2, 3, 'pass', 0, '[]', 0.9880, '{"result": "All components placed correctly, solder joints within spec"}', '/uploads/insp-004.jpg', '2026-03-02 07:45:00'),
        (2, 4, 2, 2, 1, 'warning', 1, '["DEF-VS-007"]', 0.8950, '{"result": "Minor void detected in BGA U3, 22% area - borderline", "recommendation": "Monitor next 5 units"}', '/uploads/insp-005.jpg', '2026-03-02 09:20:00'),
        (5, 8, 3, 3, 4, 'pass', 0, '[]', 0.9960, '{"result": "All dimensions within tolerance", "measurements": {"bore_diameter": 42.002, "spec": "42.00 ±0.02"}}', '/uploads/insp-006.jpg', '2026-03-05 10:30:00'),
        (5, 9, 3, 3, 4, 'fail', 1, '["DEF-DT-004"]', 0.9990, '{"result": "Bore diameter 42.035mm exceeds tolerance", "measurement": 42.035, "spec_max": 42.02}', '/uploads/insp-007.jpg', '2026-03-05 14:15:00'),
        (7, 10, 4, 4, 6, 'pass', 0, '[]', 0.9750, '{"result": "Molded part meets all specifications, no flash or sink marks"}', '/uploads/insp-008.jpg', '2026-03-07 08:00:00'),
        (7, 10, 4, 4, 6, 'fail', 2, '["DEF-FL-006", "DEF-CH-014"]', 0.9680, '{"result": "Flash 0.5mm on parting line B, hairline crack near gate area", "severity": "reject"}', '/uploads/insp-009.jpg', '2026-03-07 11:30:00'),
        (3, 5, 5, 5, 2, 'pass', 0, '[]', 0.9820, '{"result": "Assembly complete, all fasteners torqued, electrical test passed"}', '/uploads/insp-010.jpg', '2026-03-08 09:00:00'),
        (3, 6, 6, 6, 2, 'pass', 0, '[]', 0.9870, '{"result": "LED array aligned, beam pattern within spec, no hot spots"}', '/uploads/insp-011.jpg', '2026-03-10 10:15:00'),
        (6, NULL, 7, 7, 5, 'pass', 0, '[]', 0.9990, '{"result": "Gear tooth profile and runout within specification"}', '/uploads/insp-012.jpg', '2026-03-12 13:00:00'),
        (1, 1, 8, 8, 8, 'fail', 1, '["DEF-CS-005"]', 0.9540, '{"result": "Cold solder joint on connector J4 pin 3", "rework_required": true}', '/uploads/insp-013.jpg', '2026-03-13 22:30:00'),
        (1, 2, 8, 8, 8, 'pass', 0, '[]', 0.9780, '{"result": "Post-rework inspection passed, all joints acceptable"}', '/uploads/insp-014.jpg', '2026-03-13 23:15:00'),
        (9, 11, 4, 4, 12, 'warning', 1, '["DEF-OP-008"]', 0.8800, '{"result": "Slight orange peel texture on passenger side panel, borderline accept"}', '/uploads/insp-015.jpg', '2026-03-14 08:45:00'),
        (10, 12, 12, 11, 7, 'pass', 0, '[]', 0.9920, '{"result": "Weld bead profile nominal, penetration depth meets spec"}', '/uploads/insp-016.jpg', '2026-03-16 09:30:00'),
        (10, 12, 12, 11, 7, 'fail', 1, '["DEF-WP-009"]', 0.9850, '{"result": "Porosity detected in weld joint WJ-03, gas cavity 2.1mm diameter", "action": "scrap and reweld"}', '/uploads/insp-017.jpg', '2026-03-16 14:20:00'),
        (15, 15, 11, 10, 9, 'pass', 0, '[]', 0.9700, '{"result": "Continuity test passed all 156 circuits, insulation resistance >100MΩ"}', '/uploads/insp-018.jpg', '2026-03-15 11:00:00'),
        (1, 1, 1, 12, 1, 'pass', 0, '[]', 0.9830, '{"result": "Clean board, solder paste registration excellent"}', '/uploads/insp-019.jpg', '2026-03-17 08:00:00'),
        (3, 5, 14, 15, 4, 'fail', 1, '["DEF-PM-012"]', 0.9610, '{"result": "Window regulator connector P2 has pin 4 bent 1.2mm out of position", "action": "straighten and retest"}', '/uploads/insp-020.jpg', '2026-03-20 09:30:00');
    `);
    console.log('Seeded inspections.');

    // Seed Alerts
    await client.query(`
      INSERT INTO alerts (type, severity, title, message, production_line_id, acknowledged, acknowledged_by, acknowledged_at) VALUES
        ('defect_detected', 'critical', 'Critical Defect: Solder Bridge on SMT Line Alpha', 'Solder bridge detected on ECU board U12. Batch BATCH-2026-0301-001, unit #247. Immediate review required.', 1, true, 1, '2026-03-01 08:45:00'),
        ('quality_drop', 'high', 'Pass Rate Below Threshold on Injection Molding Line 1', 'Pass rate dropped to 96.2% over last 50 units. Threshold is 98.0%. Parting line flash defects increasing.', 7, true, 2, '2026-03-07 12:00:00'),
        ('spc_violation', 'high', 'SPC Upper Control Limit Exceeded - CNC Cell A', 'Bore diameter trending upward. Last 3 measurements: 42.018, 42.025, 42.035mm. UCL = 42.020mm. Tool wear suspected.', 5, true, 1, '2026-03-05 14:30:00'),
        ('line_stopped', 'critical', 'Final Assembly Line 2 Stopped - Maintenance Required', 'Line stopped due to conveyor belt misalignment sensor trigger. Maintenance team dispatched.', 4, true, 2, '2026-03-18 10:15:00'),
        ('maintenance_due', 'medium', 'Scheduled Maintenance Due: SMT Line Beta', 'Preventive maintenance scheduled for SMT Line Beta. Last maintenance: March 10. Overdue by 5 days.', 2, false, NULL, NULL),
        ('defect_detected', 'critical', 'Weld Porosity Detected on Welding Cell 1', 'Gas porosity found in weld joint WJ-03 on exhaust manifold. Part scrapped. Check shielding gas supply.', 10, true, 1, '2026-03-16 14:45:00'),
        ('quality_drop', 'medium', 'Paint Quality Declining on Coating Line', 'Orange peel texture reports increased 15% this week. Booth humidity at 72% (spec: 45-65%).', 9, false, NULL, NULL),
        ('defect_detected', 'high', 'Cold Solder Joint on Battery Management Board', 'Cold solder detected on connector J4 during night shift inspection. Rework initiated.', 1, true, 3, '2026-03-13 23:00:00'),
        ('spc_violation', 'medium', 'Process Capability Index Below Target', 'Cpk for fuel injector nozzle flow rate dropped to 1.15. Target minimum Cpk is 1.33.', 5, false, NULL, NULL),
        ('maintenance_due', 'low', 'Routine Calibration Due: AOI Camera SMT-B', 'Annual calibration due for AOI camera on SMT Line Beta. Last calibrated: March 20, 2025.', 2, false, NULL, NULL),
        ('defect_detected', 'high', 'Connector Pin Misalignment on Assembly Line 1', 'Window regulator connector P2 pin bent during insertion. Review insertion fixture alignment.', 3, false, NULL, NULL),
        ('line_stopped', 'critical', 'Injection Molding Line 2 Offline', 'Line taken offline for mold cavity repair. Estimated downtime: 48 hours. Production rerouted to Line 1.', 8, true, 1, '2026-02-28 09:00:00'),
        ('quality_drop', 'high', 'Wire Harness Test Failure Rate Increasing', 'Three continuity failures in last 50 units tested. Normal rate is <1 per 500. Investigate crimping station.', 15, false, NULL, NULL),
        ('maintenance_due', 'medium', 'CNC Tool Change Required - Cell B', 'Tool T07 (finishing end mill) has exceeded 80% of recommended tool life. 1,847 of 2,000 parts completed.', 6, false, NULL, NULL),
        ('spc_violation', 'high', 'Mean Shift Detected in Gear Tooth Profile', 'Gear tooth involute profile showing consistent positive deviation. Mean shift of +0.008mm detected. Hob wear likely.', 6, false, NULL, NULL);
    `);
    console.log('Seeded alerts.');

    // Seed Reports
    await client.query(`
      INSERT INTO reports (title, type, production_line_id, date_from, date_to, data, generated_by) VALUES
        ('Daily Quality Report - SMT Line Alpha - Mar 1', 'daily', 1, '2026-03-01', '2026-03-01', '{"total_inspections": 500, "pass_rate": 99.2, "defects": 4, "top_defect": "Solder Bridge"}', 1),
        ('Daily Quality Report - SMT Line Beta - Mar 2', 'daily', 2, '2026-03-02', '2026-03-02', '{"total_inspections": 200, "pass_rate": 99.5, "defects": 1, "top_defect": "Void in Solder"}', 1),
        ('Weekly Quality Report - All Lines - Week 10', 'weekly', NULL, '2026-03-02', '2026-03-08', '{"total_inspections": 2350, "pass_rate": 98.7, "lines_active": 13, "critical_defects": 3}', 1),
        ('Daily Quality Report - CNC Cell A - Mar 5', 'daily', 5, '2026-03-05', '2026-03-05', '{"total_inspections": 150, "pass_rate": 99.3, "defects": 1, "top_defect": "Dimensional OOT"}', 2),
        ('Daily Quality Report - Injection Molding 1 - Mar 7', 'daily', 7, '2026-03-07', '2026-03-07', '{"total_inspections": 1000, "pass_rate": 98.5, "defects": 15, "top_defect": "Flash"}', 2),
        ('Weekly Quality Report - All Lines - Week 11', 'weekly', NULL, '2026-03-09', '2026-03-15', '{"total_inspections": 3100, "pass_rate": 99.1, "lines_active": 14, "critical_defects": 2}', 1),
        ('Monthly Quality Report - February 2026', 'monthly', NULL, '2026-02-01', '2026-02-28', '{"total_inspections": 12500, "pass_rate": 98.9, "top_defects": ["Flash", "Solder Bridge", "Surface Scratch"]}', 1),
        ('Daily Quality Report - Welding Cell 1 - Mar 16', 'daily', 10, '2026-03-16', '2026-03-16', '{"total_inspections": 80, "pass_rate": 97.5, "defects": 2, "top_defect": "Weld Porosity"}', 3),
        ('Custom Report - Paint Line Analysis Q1', 'custom', 9, '2026-01-01', '2026-03-15', '{"total_inspections": 4200, "pass_rate": 97.8, "common_defects": ["Orange Peel", "Runs", "Fish Eyes"]}', 2),
        ('Daily Quality Report - Wire Harness - Mar 15', 'daily', 15, '2026-03-15', '2026-03-15', '{"total_inspections": 50, "pass_rate": 98.0, "defects": 1, "top_defect": "Continuity Failure"}', 3),
        ('Daily Quality Report - SMT Alpha - Mar 13', 'daily', 1, '2026-03-13', '2026-03-13', '{"total_inspections": 400, "pass_rate": 98.5, "defects": 6, "top_defect": "Cold Solder Joint"}', 1),
        ('Custom Report - CNC Capability Study', 'custom', 5, '2026-02-01', '2026-03-15', '{"cpk_bore": 1.45, "cpk_depth": 1.62, "ppk_bore": 1.38, "total_measured": 2800}', 2),
        ('Weekly Quality Report - All Lines - Week 12', 'weekly', NULL, '2026-03-16', '2026-03-20', '{"total_inspections": 1170, "pass_rate": 98.8, "lines_active": 13, "critical_defects": 1}', 1),
        ('Daily Quality Report - Assembly Line 1 - Mar 20', 'daily', 3, '2026-03-20', '2026-03-20', '{"total_inspections": 120, "pass_rate": 99.2, "defects": 1, "top_defect": "Pin Misalignment"}', 2),
        ('Custom Report - Defect Pareto Analysis', 'custom', NULL, '2026-01-01', '2026-03-20', '{"top_5_defects": [{"name": "Flash", "count": 89}, {"name": "Solder Bridge", "count": 67}, {"name": "Surface Scratch", "count": 45}, {"name": "Dimensional OOT", "count": 34}, {"name": "Cold Solder", "count": 28}]}', 1);
    `);
    console.log('Seeded reports.');

    // Seed Shifts
    await client.query(`
      INSERT INTO shifts (name, start_time, end_time, operator_ids, production_line_id, date, notes) VALUES
        ('Morning Shift A', '06:00', '14:00', '[1, 3, 11]', 1, '2026-03-20', 'Standard morning operations. Batch BATCH-2026-0317-001 continuation.'),
        ('Morning Shift B', '06:00', '14:00', '[2, 10]', 2, '2026-03-20', 'AOI calibration check scheduled at 10:00.'),
        ('Morning Shift C', '06:00', '14:00', '[1, 3]', 3, '2026-03-20', 'New batch BATCH-2026-0320-001 starting. Window regulator assembly.'),
        ('Afternoon Shift A', '14:00', '22:00', '[4, 6]', 1, '2026-03-20', 'Continue batch from morning shift.'),
        ('Afternoon Shift B', '14:00', '22:00', '[5, 12]', 5, '2026-03-20', 'Tool change T07 scheduled at 15:00.'),
        ('Afternoon Shift C', '14:00', '22:00', '[13, 6]', 7, '2026-03-20', 'Monitoring flash defect trend. Mold inspection at shift start.'),
        ('Night Shift A', '22:00', '06:00', '[7, 8, 9]', 1, '2026-03-20', 'Reduced throughput overnight. Priority on quality over speed.'),
        ('Night Shift B', '22:00', '06:00', '[14]', 10, '2026-03-20', 'Single operator. Welding cell autonomous mode.'),
        ('Morning Shift A', '06:00', '14:00', '[1, 3, 11]', 1, '2026-03-19', 'Batch BATCH-2026-0317-001 started. Initial setup verified.'),
        ('Morning Shift D', '06:00', '14:00', '[2, 10]', 9, '2026-03-19', 'Paint booth humidity issue reported. Maintenance notified.'),
        ('Afternoon Shift D', '14:00', '22:00', '[4, 12]', 3, '2026-03-19', 'Assembly line running LED headlamp batch.'),
        ('Night Shift C', '22:00', '06:00', '[7, 8]', 15, '2026-03-19', 'Wire harness continuity testing overnight run.'),
        ('Morning Shift E', '06:00', '14:00', '[3, 11]', 12, '2026-03-20', 'Packaging label verification focus. New SKU labels loaded.'),
        ('Afternoon Shift E', '14:00', '22:00', '[5, 13]', 6, '2026-03-20', 'CNC Cell B - Gear set finishing. Monitor tooth profile SPC.'),
        ('Morning Shift F', '06:00', '14:00', '[2, 10]', 14, '2026-03-20', 'Test bay full validation suite running. Thermal cam needs repair.');
    `);
    console.log('Seeded shifts.');

    // Seed Downtime Events
    await client.query(`
      INSERT INTO downtime_events (production_line_id, reason, start_time, end_time, duration_minutes, description, impact, resolved_by) VALUES
        (1, 'planned_maintenance', '2026-03-01 06:00:00', '2026-03-01 08:00:00', 120, 'Scheduled quarterly maintenance on SMT Line Alpha reflow oven', 'Delayed morning batch start by 2 hours', 1),
        (4, 'unplanned_breakdown', '2026-03-02 14:30:00', '2026-03-02 18:45:00', 255, 'Conveyor belt motor failure on Final Assembly Line 2', 'Lost 200 units of production capacity', 2),
        (7, 'material_shortage', '2026-03-03 09:00:00', '2026-03-03 11:30:00', 150, 'ABS+PC resin supply delayed from vendor', 'Injection Molding Line 1 idle for 2.5 hours', NULL),
        (5, 'quality_hold', '2026-03-05 14:00:00', '2026-03-05 16:00:00', 120, 'CNC Cell A halted due to dimensional out-of-tolerance trend', 'Held 15 parts for re-inspection', 1),
        (2, 'changeover', '2026-03-06 06:00:00', '2026-03-06 07:30:00', 90, 'Product changeover from Power Inverter to Battery Management PCB', 'Normal changeover time within target', 3),
        (8, 'unplanned_breakdown', '2026-02-28 08:00:00', '2026-03-02 08:00:00', 2880, 'Injection mold cavity crack on Molding Line 2, requires full repair', 'Line taken offline for 48 hours, production rerouted', 1),
        (9, 'quality_hold', '2026-03-07 13:00:00', '2026-03-07 15:00:00', 120, 'Paint booth humidity exceeded spec range at 72%', 'Rejected 30 painted parts, recalibrated HVAC', 2),
        (10, 'planned_maintenance', '2026-03-09 06:00:00', '2026-03-09 10:00:00', 240, 'Welding robot torch replacement and wire feed calibration', 'Scheduled downtime, no production impact', 3),
        (3, 'unplanned_breakdown', '2026-03-10 11:00:00', '2026-03-10 13:30:00', 150, 'Pneumatic actuator failure on station 3 of assembly line', 'Slowed throughput by 40% until repair completed', 2),
        (1, 'changeover', '2026-03-13 05:30:00', '2026-03-13 06:15:00', 45, 'Stencil change for Battery Management PCB batch', 'Minor delay to morning shift start', 1),
        (12, 'material_shortage', '2026-03-14 10:00:00', '2026-03-14 14:00:00', 240, 'Shipping boxes and foam inserts not delivered on time', 'Packaging Line A idle, finished goods stacked on pallets', NULL),
        (6, 'planned_maintenance', '2026-03-15 06:00:00', '2026-03-15 09:00:00', 180, 'CNC Cell B spindle bearing replacement per predictive schedule', 'Planned downtime, backup cell handled overflow', 3),
        (15, 'unplanned_breakdown', '2026-03-16 15:00:00', '2026-03-16 17:00:00', 120, 'Continuity test fixture calibration drift detected', 'Retested last 20 harnesses, all passed', 2),
        (7, 'changeover', '2026-03-18 06:00:00', '2026-03-18 07:00:00', 60, 'Mold swap for Steering Column Shroud production run', 'Standard changeover completed on time', 1),
        (14, 'other', '2026-03-19 08:00:00', '2026-03-19 09:30:00', 90, 'Thermal camera malfunction in Testing Bay, replaced sensor', 'Delayed validation testing by 1.5 hours', 3)
    `);
    console.log('Seeded downtime events.');

    // Seed Maintenance Schedules
    await client.query(`
      INSERT INTO maintenance_schedules (production_line_id, type, title, description, priority, status, assigned_to, scheduled_date, completed_date, estimated_duration_hours, actual_duration_hours, parts_required, notes) VALUES
        (1, 'preventive', 'SMT Alpha Reflow Oven PM', 'Quarterly preventive maintenance on reflow oven including thermocouple calibration', 'high', 'completed', 'Robert Zhang', '2026-03-01', '2026-03-01', 4.00, 3.50, '["thermocouples x4", "conveyor belt lubricant", "HEPA filters x2"]', 'Completed ahead of schedule. All zones within spec.'),
        (2, 'preventive', 'SMT Beta AOI Calibration', 'Annual AOI camera system calibration and lens cleaning', 'high', 'overdue', 'Yuki Tanaka', '2026-03-15', NULL, 2.00, NULL, '["calibration target board", "lens cleaning kit"]', 'Overdue by 5 days. Rescheduled for March 22.'),
        (4, 'corrective', 'Assembly Line 2 Conveyor Motor Replacement', 'Emergency replacement of failed conveyor drive motor', 'critical', 'completed', 'Robert Zhang', '2026-03-02', '2026-03-02', 6.00, 4.25, '["drive motor 2.2kW", "coupling assembly", "motor mount bolts"]', 'Root cause: bearing failure due to overheating. Added monitoring sensor.'),
        (5, 'predictive', 'CNC Cell A Tool Wear Compensation', 'Adjust tool offset based on SPC trend data for bore diameter', 'medium', 'completed', 'Yuki Tanaka', '2026-03-05', '2026-03-05', 1.00, 0.75, '[]', 'Tool T03 offset adjusted by -0.015mm. Cpk restored to 1.45.'),
        (10, 'preventive', 'Welding Cell 1 Torch and Wire Feed Service', 'Replace welding torch tip, clean wire feed mechanism, calibrate gas flow', 'high', 'completed', 'Michael Chang', '2026-03-09', '2026-03-09', 4.00, 4.00, '["torch tip CuCrZr", "wire feed rollers", "gas flow meter"]', 'Replaced torch tip and rollers. Gas flow calibrated at 18 L/min.'),
        (6, 'preventive', 'CNC Cell B Spindle Bearing Replacement', 'Predictive replacement based on vibration analysis trending', 'high', 'completed', 'Robert Zhang', '2026-03-15', '2026-03-15', 6.00, 5.50, '["spindle bearings x2 (7014 AC)", "spindle oil 1L", "bearing puller set"]', 'Vibration levels returned to baseline after replacement.'),
        (7, 'preventive', 'Injection Molding Line 1 Mold Inspection', 'Inspect parting line wear, check ejector pins, clean vents', 'medium', 'completed', 'Carlos Rivera', '2026-03-12', '2026-03-12', 3.00, 3.50, '["ejector pin set", "mold polish compound", "vent cleaning tools"]', 'Found minor wear on parting line section B. Polished and re-qualified.'),
        (8, 'corrective', 'Injection Molding Line 2 Mold Cavity Repair', 'Full repair of cracked mold cavity insert on Line 2', 'critical', 'completed', 'Robert Zhang', '2026-02-28', '2026-03-02', 48.00, 52.00, '["mold cavity insert (P20 steel)", "EDM electrodes", "polishing stones"]', 'Cavity replaced and qualified. Root cause: thermal fatigue cracking.'),
        (9, 'corrective', 'Paint Booth HVAC Recalibration', 'Recalibrate humidity control after out-of-spec readings', 'high', 'completed', 'Michael Chang', '2026-03-07', '2026-03-07', 2.00, 2.00, '["humidity sensor", "HVAC controller firmware update"]', 'Humidity sensor replaced. Readings now stable at 55% RH.'),
        (3, 'corrective', 'Assembly Line 1 Pneumatic Actuator Replacement', 'Replace failed pneumatic actuator on station 3', 'critical', 'completed', 'Carlos Rivera', '2026-03-10', '2026-03-10', 3.00, 2.50, '["pneumatic cylinder 80mm bore", "flow control valves x2", "tubing 6mm"]', 'Actuator replaced. Added pressure monitoring to prevent future failures.'),
        (12, 'preventive', 'Packaging Line A Label Printer PM', 'Clean print heads, replace ribbon, calibrate label position sensor', 'low', 'scheduled', 'Sophie Martin', '2026-03-22', NULL, 1.50, NULL, '["thermal ribbon roll", "print head cleaning swabs", "calibration labels"]', 'Scheduled for next maintenance window.'),
        (15, 'corrective', 'Wire Harness Test Fixture Recalibration', 'Recalibrate continuity test fixture after drift detected', 'high', 'completed', 'Yuki Tanaka', '2026-03-16', '2026-03-16', 2.00, 2.00, '["calibration reference harness", "contact probes x12"]', 'Fixture recalibrated. All test channels within 0.1 ohm tolerance.'),
        (14, 'corrective', 'Test Bay Thermal Camera Replacement', 'Replace malfunctioning thermal imaging camera sensor', 'medium', 'in_progress', 'Michael Chang', '2026-03-19', NULL, 3.00, NULL, '["thermal camera sensor module", "mounting bracket", "calibration blackbody"]', 'Sensor ordered. Expected delivery March 21.'),
        (6, 'predictive', 'CNC Cell B Tool Life Monitoring Alert', 'Tool T07 finishing end mill approaching end of life per cycle counter', 'medium', 'scheduled', 'Yuki Tanaka', '2026-03-21', NULL, 0.50, NULL, '["end mill 12mm 4-flute carbide"]', 'Tool at 92% life. Schedule replacement before next gear batch.'),
        (1, 'preventive', 'SMT Alpha Stencil Cleaning and Inspection', 'Deep clean solder paste stencils and inspect aperture condition', 'low', 'scheduled', 'Carlos Rivera', '2026-03-25', NULL, 1.00, NULL, '["ultrasonic cleaning solution", "stencil inspection light"]', 'Routine monthly stencil maintenance.')
    `);
    console.log('Seeded maintenance schedules.');

    // Seed Audit Trail
    await client.query(`
      INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details, ip_address, created_at) VALUES
        (1, 'login', 'user', 1, '{"method": "password", "browser": "Chrome 122"}', '192.168.1.50', '2026-03-20 06:00:00'),
        (2, 'login', 'user', 2, '{"method": "password", "browser": "Firefox 125"}', '192.168.1.51', '2026-03-20 06:05:00'),
        (1, 'create', 'batch', 15, '{"batch_number": "BATCH-2026-0320-001", "product": "Electric Window Regulator"}', '192.168.1.50', '2026-03-20 06:10:00'),
        (2, 'update', 'production_line', 4, '{"field": "status", "old_value": "active", "new_value": "maintenance"}', '192.168.1.51', '2026-03-18 10:20:00'),
        (1, 'create', 'alert', 4, '{"title": "Final Assembly Line 2 Stopped", "severity": "critical"}', '192.168.1.50', '2026-03-18 10:15:00'),
        (3, 'login', 'user', 3, '{"method": "password", "browser": "Chrome 122"}', '192.168.1.52', '2026-03-17 06:00:00'),
        (1, 'generate_report', 'report', 13, '{"title": "Weekly Quality Report - Week 12", "type": "weekly"}', '192.168.1.50', '2026-03-20 08:00:00'),
        (2, 'generate_report', 'report', 14, '{"title": "Daily Quality Report - Assembly Line 1", "type": "daily"}', '192.168.1.51', '2026-03-20 09:00:00'),
        (1, 'update', 'alert', 1, '{"field": "acknowledged", "old_value": false, "new_value": true}', '192.168.1.50', '2026-03-01 08:45:00'),
        (2, 'update', 'alert', 2, '{"field": "acknowledged", "old_value": false, "new_value": true}', '192.168.1.51', '2026-03-07 12:00:00'),
        (1, 'export', 'inspections', NULL, '{"format": "csv", "date_range": "2026-03-01 to 2026-03-15", "records": 350}', '192.168.1.50', '2026-03-16 10:00:00'),
        (1, 'delete', 'report', 7, '{"title": "Monthly Quality Report - February 2026", "reason": "regenerated with corrections"}', '192.168.1.50', '2026-03-15 14:00:00'),
        (2, 'create', 'maintenance_schedule', 11, '{"title": "Packaging Line A Label Printer PM", "type": "preventive"}', '192.168.1.51', '2026-03-18 11:00:00'),
        (3, 'update', 'inspection', 13, '{"field": "status", "old_value": "fail", "new_value": "pass", "note": "post-rework re-inspection"}', '192.168.1.52', '2026-03-13 23:15:00'),
        (1, 'generate_report', 'report', 15, '{"title": "Defect Pareto Analysis", "type": "custom", "date_range": "Q1 2026"}', '192.168.1.50', '2026-03-20 10:30:00')
    `);
    console.log('Seeded audit trail.');

    // Seed Inventory
    await client.query(`
      INSERT INTO inventory (part_name, part_number, category, quantity_in_stock, minimum_stock_level, unit_cost, supplier, location, production_line_id, status, last_restocked) VALUES
        ('Solder Paste Cartridge', 'SP-4900-PB', 'consumable', 45, 10, 89.99, 'Kester Inc.', 'Warehouse A - Shelf 3', 1, 'in_stock', '2026-03-15 08:00:00'),
        ('SMT Nozzle Type 502', 'NZ-502-SM', 'mechanical', 3, 5, 245.00, 'Juki Parts', 'Tool Crib B', 1, 'low_stock', '2026-02-28 10:00:00'),
        ('Conveyor Belt 1200mm', 'CB-1200-HD', 'mechanical', 2, 2, 1200.00, 'FlexLink Systems', 'Warehouse B - Bay 7', 3, 'low_stock', '2026-01-20 14:00:00'),
        ('Servo Motor 400W', 'SM-400W-AC', 'electrical', 8, 3, 567.50, 'Siemens AG', 'Warehouse A - Shelf 12', 5, 'in_stock', '2026-03-10 09:00:00'),
        ('Pneumatic Cylinder 50mm', 'PC-050-DB', 'pneumatic', 15, 5, 78.25, 'SMC Corporation', 'Warehouse A - Shelf 8', 7, 'in_stock', '2026-03-12 11:00:00'),
        ('Hydraulic Filter Element', 'HF-200-MX', 'hydraulic', 0, 4, 134.00, 'Parker Hannifin', 'Warehouse B - Bay 2', 5, 'out_of_stock', '2026-01-05 08:00:00'),
        ('Safety Light Curtain', 'SL-800-T4', 'safety', 2, 1, 890.00, 'SICK AG', 'Warehouse C - Safety', 10, 'in_stock', '2026-03-01 10:00:00'),
        ('Welding Wire 1.2mm', 'WW-120-SS', 'consumable', 120, 50, 45.00, 'Lincoln Electric', 'Warehouse B - Bay 5', 10, 'in_stock', '2026-03-18 07:00:00'),
        ('PLC Module DI16', 'PLC-DI16-S7', 'electrical', 1, 2, 425.00, 'Siemens AG', 'Tool Crib A', NULL, 'low_stock', '2026-02-15 09:00:00'),
        ('Injection Mold Heater Band', 'HB-220V-800W', 'electrical', 6, 4, 156.00, 'Watlow', 'Warehouse A - Shelf 15', 7, 'in_stock', '2026-03-08 13:00:00'),
        ('CNC Spindle Bearing', 'SB-7210-AC', 'mechanical', 4, 2, 320.00, 'SKF Group', 'Tool Crib B', 5, 'in_stock', '2026-03-05 08:00:00'),
        ('Paint Spray Nozzle', 'PSN-1.4-HVLP', 'consumable', 0, 10, 28.50, 'DeVilbiss', 'Paint Shop Storage', 9, 'out_of_stock', '2026-02-01 08:00:00'),
        ('Emergency Stop Button', 'ES-40-RED', 'safety', 10, 3, 42.00, 'Allen-Bradley', 'Warehouse C - Safety', NULL, 'in_stock', '2026-03-14 10:00:00'),
        ('Thermal Paste Tube', 'TP-100G-HT', 'consumable', 30, 15, 12.99, 'Arctic Silver', 'Warehouse A - Shelf 1', 14, 'in_stock', '2026-03-19 08:00:00'),
        ('Wire Crimp Terminal Kit', 'CT-500-MIX', 'consumable', 8, 10, 65.00, 'TE Connectivity', 'Warehouse A - Shelf 6', 15, 'low_stock', '2026-03-02 09:00:00')
    `);
    console.log('Seeded inventory.');

    // Seed Training Records
    await client.query(`
      INSERT INTO training_records (operator_id, training_type, title, description, trainer, certification_name, certification_number, start_date, completion_date, expiry_date, status, score, notes) VALUES
        (1, 'safety', 'Annual Safety Certification', 'Comprehensive workplace safety training covering OSHA standards', 'Robert Williams', 'OSHA Safety Certified', 'OSC-2026-001', '2026-01-15', '2026-01-17', '2027-01-17', 'completed', 95.5, 'Passed with distinction'),
        (2, 'quality', 'SPC Fundamentals', 'Statistical process control techniques for quality inspection', 'Dr. Emily Park', 'SPC Level 2', 'SPC-2026-042', '2026-02-01', '2026-02-05', '2028-02-05', 'completed', 88.0, 'Strong understanding of control charts'),
        (3, 'equipment', 'CNC Operation Level 3', 'Advanced CNC machining center operation and programming', 'James Mitchell', 'CNC Master Operator', 'CNC-2026-015', '2026-02-10', '2026-02-20', '2027-02-20', 'completed', 92.0, NULL),
        (4, 'process', 'Lean Manufacturing Basics', 'Introduction to lean principles and waste reduction', 'Lisa Thompson', NULL, NULL, '2026-03-01', '2026-03-03', NULL, 'completed', 78.5, 'Needs follow-up on value stream mapping'),
        (5, 'compliance', 'ISO 9001:2015 Internal Auditor', 'Training for conducting internal quality audits', 'Prof. Michael Chen', 'ISO 9001 Internal Auditor', 'ISO-IA-2026-008', '2026-03-10', '2026-03-14', '2027-03-14', 'completed', 91.0, 'Qualified to lead internal audits'),
        (1, 'equipment', 'SMT Line Setup & Calibration', 'Surface mount technology line setup procedures', 'David Kim', NULL, NULL, '2026-03-20', NULL, NULL, 'in_progress', NULL, 'Currently completing module 3 of 5'),
        (6, 'safety', 'Forklift Operator Certification', 'Forklift operation and warehouse safety', 'Robert Williams', 'Forklift Operator', 'FLO-2026-033', '2026-01-08', '2026-01-08', '2026-04-08', 'completed', 85.0, 'Certification expiring soon'),
        (7, 'quality', 'Visual Inspection Techniques', 'Advanced visual inspection methods for defect detection', 'Dr. Emily Park', 'Visual Inspector Level 2', 'VI-2026-019', '2025-12-01', '2025-12-05', '2026-04-05', 'completed', 90.0, 'Expiring next month'),
        (8, 'equipment', 'Welding Robot Programming', 'Programming and troubleshooting welding robots', 'James Mitchell', NULL, NULL, '2026-04-01', NULL, NULL, 'scheduled', NULL, 'Waiting for new robot firmware update'),
        (3, 'compliance', 'ESD Handling Procedures', 'Electrostatic discharge prevention and handling', 'Technical Team', 'ESD Certified Handler', 'ESD-2025-101', '2025-06-15', '2025-06-15', '2026-03-15', 'expired', 82.0, 'Renewal required - expired March 15'),
        (2, 'safety', 'Lockout/Tagout Procedures', 'Energy control procedures for equipment maintenance', 'Robert Williams', 'LOTO Certified', 'LOTO-2026-055', '2026-02-20', '2026-02-21', '2027-02-21', 'completed', 97.0, 'Perfect score on practical exam'),
        (5, 'process', 'Six Sigma Green Belt', 'Six Sigma methodology and DMAIC process', 'Prof. Michael Chen', 'Six Sigma Green Belt', 'SSGB-2026-003', '2026-01-20', NULL, NULL, 'in_progress', NULL, 'Completing final project phase')
    `);
    console.log('Seeded training records.');

    // Seed Quality Goals
    await client.query(`
      INSERT INTO quality_goals (name, description, target_value, current_value, unit, category, production_line_id, product_id, start_date, end_date, status) VALUES
        ('SMT Line Alpha Yield Target', 'Achieve 99% first-pass yield on SMT Line Alpha', 99.00, 97.80, '%', 'first_pass_yield', 1, NULL, '2026-01-01', '2026-06-30', 'active'),
        ('Overall Defect Rate Reduction', 'Reduce overall defect rate below 0.5%', 0.50, 0.65, '%', 'defect_rate', NULL, NULL, '2026-01-01', '2026-12-31', 'active'),
        ('CNC Cell Throughput', 'Increase CNC cell throughput to 90 units/hour', 90.00, 82.00, 'units/hr', 'throughput', 5, NULL, '2026-01-01', '2026-06-30', 'active'),
        ('Q1 OEE Target', 'Achieve 85% OEE across all production lines', 85.00, 85.20, '%', 'oee', NULL, NULL, '2026-01-01', '2026-03-31', 'achieved'),
        ('Injection Molding Yield', 'Maintain 98.5% yield on injection molding lines', 98.50, 97.20, '%', 'yield', 7, NULL, '2026-01-01', '2026-06-30', 'active'),
        ('Welding Defect Rate', 'Reduce welding defects below 1%', 1.00, 1.35, '%', 'defect_rate', 10, NULL, '2026-02-01', '2026-07-31', 'active'),
        ('Paint Line First Pass Yield', 'Achieve 96% first pass on paint line', 96.00, 93.50, '%', 'first_pass_yield', 9, NULL, '2026-01-01', '2026-06-30', 'active'),
        ('Packaging Throughput Q1', 'Package 850 units/hour across both lines', 850.00, 775.00, 'units/hr', 'throughput', NULL, NULL, '2026-01-01', '2026-03-31', 'missed'),
        ('Wire Harness Zero Defect', 'Achieve zero critical defects in wire harnesses', 0.00, 2.00, 'defects', 'defect_rate', 15, NULL, '2026-03-01', '2026-05-31', 'active'),
        ('Assembly Module OEE', 'Hit 80% OEE on final assembly lines', 80.00, 78.50, '%', 'oee', 3, NULL, '2026-01-01', '2026-06-30', 'active')
    `);
    console.log('Seeded quality goals.');

    // Seed Work Orders
    await client.query(`
      INSERT INTO work_orders (order_number, title, description, type, priority, status, production_line_id, product_id, assigned_to, quantity_ordered, quantity_completed, due_date, started_at, completed_at, notes) VALUES
        ('WO-2026-001', 'PCB Assembly Batch 500', 'Production run of 500 PCB assemblies for Order #A1042', 'production', 'high', 'in_progress', 1, 1, 'Sarah Chen', 500, 320, '2026-03-25', '2026-03-18 06:00:00', NULL, 'Running ahead of schedule'),
        ('WO-2026-002', 'Rework Lot #B2055', 'Rework 45 units from Batch B2055 - solder bridge defects', 'rework', 'critical', 'in_progress', 2, 1, 'Marcus Johnson', 45, 28, '2026-03-22', '2026-03-19 07:00:00', NULL, 'Using updated solder profile'),
        ('WO-2026-003', 'Metal Frame Production', 'Produce 200 metal frames for Q2 backlog', 'production', 'medium', 'pending', 10, 3, 'David Kim', 200, 0, '2026-04-05', NULL, NULL, 'Waiting for raw material delivery'),
        ('WO-2026-004', 'Plastic Housing Run #7', 'Injection mold 1000 plastic housings', 'production', 'medium', 'completed', 7, 4, 'Lisa Thompson', 1000, 1000, '2026-03-15', '2026-03-10 06:00:00', '2026-03-14 18:00:00', 'Completed on time, 99.2% yield'),
        ('WO-2026-005', 'Incoming Material Inspection', 'Inspect incoming raw materials for Q2 production', 'inspection', 'high', 'in_progress', 14, NULL, 'Prof. Quality Team', 300, 185, '2026-03-24', '2026-03-17 08:00:00', NULL, NULL),
        ('WO-2026-006', 'CNC Spindle Replacement', 'Replace worn spindle on CNC Cell A', 'maintenance', 'critical', 'completed', 5, NULL, 'James Mitchell', 1, 1, '2026-03-20', '2026-03-19 10:00:00', '2026-03-19 16:00:00', 'Spindle replaced and calibrated'),
        ('WO-2026-007', 'Wire Harness Assembly Order', 'Assemble 150 wire harnesses for customer order', 'production', 'high', 'in_progress', 15, 5, 'Emily Park', 150, 95, '2026-03-28', '2026-03-15 06:00:00', NULL, 'Using new crimp terminals'),
        ('WO-2026-008', 'Paint Rework - Color Mismatch', 'Repaint 30 units with correct color specification', 'rework', 'medium', 'pending', 9, 4, 'Paint Team', 30, 0, '2026-03-26', NULL, NULL, 'Waiting for correct paint batch'),
        ('WO-2026-009', 'End-of-Line Test Setup', 'Configure test bay for new product variant', 'inspection', 'low', 'on_hold', 14, NULL, 'Test Engineering', 1, 0, '2026-04-01', NULL, NULL, 'On hold pending firmware release'),
        ('WO-2026-010', 'Packaging Material Change', 'Switch to new eco-friendly packaging materials', 'production', 'low', 'pending', 12, NULL, 'Packaging Team', 500, 0, '2026-04-10', NULL, NULL, 'New packaging spec under review'),
        ('WO-2026-011', 'Emergency Motor Replacement', 'Replace failed conveyor motor on Assembly Line 1', 'maintenance', 'critical', 'completed', 3, NULL, 'Maintenance Team', 1, 1, '2026-03-18', '2026-03-18 09:00:00', '2026-03-18 14:00:00', 'Downtime: 5 hours'),
        ('WO-2026-012', 'Surface Finishing Batch', 'Apply anti-corrosion coating to 250 metal parts', 'production', 'medium', 'in_progress', 9, 3, 'Coating Team', 250, 140, '2026-03-27', '2026-03-20 06:00:00', NULL, NULL)
    `);
    console.log('Seeded work orders.');

    console.log('Database seed completed successfully!');
  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
