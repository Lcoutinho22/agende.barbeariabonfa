  function toggleTheme() {
            const body = document.body;
            body.classList.toggle('dark-theme');
            const icon = document.querySelector('.theme-toggle i');
            if(body.classList.contains('dark-theme')){ icon.classList.replace('fa-moon', 'fa-sun'); } 
            else { icon.classList.replace('fa-sun', 'fa-moon'); }
        }

        // Função de scroll atualizada para o novo tamanho (150px + gap)
        function scrollGallery(dir) {
            const track = document.getElementById('galleryTrack');
            // 150 (largura) + 10 (gap) = 160
            track.scrollBy({ left: dir * 160, behavior: 'smooth' });
        }

        function scrollPrices(dir) {
            const track = document.getElementById('priceTrack');
            track.scrollBy({ left: dir * 150, behavior: 'smooth' });
        }

        function selectSpaService() {
            const serviceSelect = document.getElementById('serviceSelect');
            serviceSelect.value = "Combo Spa (Barba + Limpeza)";
        }

        function updateHours() {
            const dateInput = document.getElementById('dateSelect');
            const timeSelect = document.getElementById('timeSelect');
            
            if (!dateInput.value) return;

            const dateParts = dateInput.value.split('-');
            const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            const dayOfWeek = dateObj.getDay(); 

            timeSelect.innerHTML = '<option value="">Selecione...</option>';

            let hours = [];

            if (dayOfWeek === 6) { 
                // Sábado: 08:00 - 12:00
                hours = ['08:00', '08:50', '09:40', '10:30', '11:20', '12:00'];
            } else if (dayOfWeek === 0) {
                // Domingo
                hours = []; 
                const opt = document.createElement('option');
                opt.text = "Fechado";
                timeSelect.add(opt);
            } else {
                // Seg - Sex
                hours = ['18:00', '18:50', '19:40', '20:30', '21:20', '22:00', '22:50', '23:40', '00:30'];
            }

            hours.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h;
                opt.textContent = h;
                timeSelect.appendChild(opt);
            });
        }

        function agendarWhatsApp() {
            const nome = document.getElementById('clientName').value;
            const servico = document.getElementById('serviceSelect').value;
            const data = document.getElementById('dateSelect').value;
            const hora = document.getElementById('timeSelect').value;
            
            if(!data || !hora || hora === "Fechado") { alert("Por favor, selecione uma data e horário válidos."); return; }

            const dataObj = new Date(data);
            const dataF = dataObj.toLocaleDateString('pt-BR', {timeZone: 'UTC'});
            
            // SUBSTITUA PELO SEU NÚMERO REAL
            const whatsappNumber = "5532998033153";

            const msg = `Olá! Gostaria de agendar na Barbearia Bonfá:%0A%0A*Cliente:* ${nome}%0A*Serviço:* ${servico}%0A*Data:* ${dataF}%0A*Horário:* ${hora}`;
            window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, '_blank');
        }