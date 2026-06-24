/// EcoSynTech Farm OS — Aptos Traceability Module
/// Lưu trữ hash dữ liệu truy xuất nông sản lên Aptos blockchain
/// Tuân thủ GS1 Digital Link + EUDR 2023/1115
module farmos::trace {
    use std::string::String;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;

    // ──── Kiểu dữ liệu ────

    /// Một batch/lô nông sản
    struct Batch has key, store {
        batch_id: String,
        gtin: String,
        product_name: String,
        farm_id: String,
        crop: String,
        quantity: u64,
        unit: String,
        created_at: u64,
        tx_count: u64
    }

    /// Một stage/sự kiện trong vòng đời batch
    struct TraceEvent has store {
        batch_id: String,
        event_type: String,
        data_hash: String,
        previous_hash: String,
        timestamp: u64,
        metadata: String // JSON
    }

    /// Event emitted khi có trace mới
    struct TraceCreated has drop, store {
        batch_id: String,
        event_type: String,
        data_hash: String,
        timestamp: u64
    }

    /// Event emitted khi export
    struct ExportCreated has drop, store {
        batch_id: String,
        buyer: String,
        destination: String,
        quantity: u64,
        tx_hash: String
    }

    /// Event emitted khi certification
    struct CertCreated has drop, store {
        batch_id: String,
        cert_type: String,
        cert_body: String,
        valid_until: u64
    }

    // Storage
    struct BatchStore has key {
        batches: vector<Batch>,
        events: vector<TraceEvent>
    }

    // ──── Khởi tạo ────

    /// Khởi tạo module cho một account
    fun init_module(account: &signer) {
        move_to(account, BatchStore {
            batches: vector::empty<Batch>(),
            events: vector::empty<TraceEvent>()
        });
    }

    // ──── Public functions ────

    /// Ghi một batch mới
    public entry fun create_batch(
        account: &signer,
        batch_id: String,
        gtin: String,
        product_name: String,
        farm_id: String,
        crop: String,
        quantity: u64,
        unit: String
    ) acquires BatchStore {
        let store = borrow_global_mut<BatchStore>(signer::address_of(account));
        
        let batch = Batch {
            batch_id,
            gtin,
            product_name,
            farm_id,
            crop,
            quantity,
            unit,
            created_at: timestamp::now_seconds(),
            tx_count: 0
        };
        
        vector::push_back(&mut store.batches, batch);
        
        event::emit(TraceCreated {
            batch_id: batch.batch_id,
            event_type: string::utf8(b"batch_create"),
            data_hash: string::utf8(b""),
            timestamp: timestamp::now_seconds()
        });
    }

    /// Ghi một trace event (stage, harvest, quality check)
    public entry fun record_event(
        account: &signer,
        batch_id: String,
        event_type: String,
        data_hash: String,
        previous_hash: String,
        metadata: String
    ) acquires BatchStore {
        let store = borrow_global_mut<BatchStore>(signer::address_of(account));
        
        // Tìm và cập nhật batch
        let len = vector::length(&store.batches);
        let i = 0;
        while (i < len) {
            let batch = vector::borrow_mut(&mut store.batches, i);
            if (batch.batch_id == batch_id) {
                batch.tx_count = batch.tx_count + 1;
            };
            i = i + 1;
        };

        let event = TraceEvent {
            batch_id,
            event_type,
            data_hash,
            previous_hash,
            timestamp: timestamp::now_seconds(),
            metadata
        };
        
        vector::push_back(&mut store.events, event);
        
        event::emit(TraceCreated {
            batch_id: event.batch_id,
            event_type: event.event_type,
            data_hash: event.data_hash,
            timestamp: event.timestamp
        });
    }

    /// Ghi export
    public entry fun record_export(
        account: &signer,
        batch_id: String,
        buyer: String,
        destination: String,
        quantity: u64,
        data_hash: String,
        previous_hash: String
    ) acquires BatchStore {
        // Record event trước
        record_event(account, batch_id, string::utf8(b"export"), data_hash, previous_hash, string::utf8(b""));
        
        // Emit export event riêng
        event::emit(ExportCreated {
            batch_id,
            buyer,
            destination,
            quantity,
            tx_hash: data_hash
        });
    }

    /// Ghi certification
    public entry fun record_certification(
        account: &signer,
        batch_id: String,
        cert_type: String,
        cert_body: String,
        valid_until: u64,
        data_hash: String
    ) acquires BatchStore {
        record_event(account, batch_id, string::utf8(b"certification"), data_hash, string::utf8(b""), string::utf8(b""));
        
        event::emit(CertCreated {
            batch_id,
            cert_type,
            cert_body,
            valid_until
        });
    }

    // ──── View functions ────

    /// Lấy số lượng events của một batch
    #[view]
    public fun get_event_count(account_addr: address, batch_id: String): u64 acquires BatchStore {
        let store = borrow_global<BatchStore>(account_addr);
        let len = vector::length(&store.events);
        let count = 0;
        let i = 0;
        while (i < len) {
            let evt = vector::borrow(&store.events, i);
            if (evt.batch_id == batch_id) {
                count = count + 1;
            };
            i = i + 1;
        };
        count
    }

    /// Verify một data_hash có tồn tại trên chain không
    #[view]
    public fun verify_hash(account_addr: address, batch_id: String, data_hash: String): bool acquires BatchStore {
        let store = borrow_global<BatchStore>(account_addr);
        let len = vector::length(&store.events);
        let i = 0;
        while (i < len) {
            let evt = vector::borrow(&store.events, i);
            if (evt.batch_id == batch_id && evt.data_hash == data_hash) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Lấy tổng số batch
    #[view]
    public fun total_batches(account_addr: address): u64 acquires BatchStore {
        let store = borrow_global<BatchStore>(account_addr);
        vector::length(&store.batches)
    }

    /// Lấy tổng số events
    #[view]
    public fun total_events(account_addr: address): u64 acquires BatchStore {
        let store = borrow_global<BatchStore>(account_addr);
        vector::length(&store.events)
    }

    /// Kiểm tra module đã initialized chưa
    #[view]
    public fun is_initialized(account_addr: address): bool {
        exists<BatchStore>(account_addr)
    }
}
