class ProjectGraphEditor {
    constructor() {
        this.canvas = document.getElementById("canvas");  // Obtiene el elemento canvas del DOM.
        this.ctx = this.canvas.getContext("2d");
        this.tasks = [];// Array para almacenar las tareas (nodos del grafo).
        this.dependencies = []; // Array para almacenar las dependencias (aristas del grafo).
        this.mode = "addTask";// Modo actual de interacción de la aplicación (agregar tarea, agregar dependencia, editar, eliminar).
        this.selectedTask = null;
        this.selectedDependency = null;
        this.draggedTask = null;
        this.dependencyStart = null;
        this.taskIdCounter = 1; // Contador para asignar IDs únicos a las tareas.
        this.dependencyIdCounter = 1;// Contador para asignar IDs únicos a las dependencias.
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };//mantener la posición relativa del cursor al arrastrar.
        this.pendingTaskPos = null;
        this.pendingDependencyData = null;
        this.showCriticalPath = false;
        this.criticalPathTasks = [];

        // Configura el tamaño del canvas.
        this.setupCanvas();
        // Configura los escuchadores de eventos.
        this.setupEventListeners();
        // Actualiza la información del resumen del proyecto.
        this.updateInfo();
        // Dibuja el grafo en el canvas.
        this.draw();
    }

    // Configura el tamaño del canvas para que se ajuste al contenedor y sea responsivo.
    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement; // Obtiene el contenedor padre del canvas.
            this.canvas.width = container.clientWidth; // Establece el ancho del canvas al ancho del contenedor.
            this.canvas.height = container.clientHeight; // Establece la altura del canvas a la altura del contenedor.
            this.draw(); // Redibuja el grafo después de redimensionar.
        };

        resizeCanvas(); // Llama a la función una vez al inicio.
        window.addEventListener("resize", resizeCanvas); // Agrega un escuchador para redimensionar el canvas cuando la ventana cambie de tamaño.
    }

    // Configura los botones, el canvas y los modales.
    setupEventListeners() {
        document.getElementById("addTaskBtn").addEventListener("click", () => this.setMode("addTask"));
        document.getElementById("addDependencyBtn").addEventListener("click", () => this.setMode("addDependency"));
        document.getElementById("editBtn").addEventListener("click", () => this.setMode("edit"));
        document.getElementById("deleteBtn").addEventListener("click", () => this.setMode("delete"));
        document.getElementById("clearBtn").addEventListener("click", () => this.clearAll());
        document.getElementById("criticalPathBtn").addEventListener("click", () => this.toggleCriticalPath());
    // New feature buttons (may be absent in original HTML)
    const adjBtn = document.getElementById("adjMatrixBtn");
    if (adjBtn) adjBtn.addEventListener("click", () => this.showAdjacencyMatrix());
    const incBtn = document.getElementById("incidenceMatrixBtn");
    if (incBtn) incBtn.addEventListener("click", () => this.showIncidenceMatrix());
    const dijBtn = document.getElementById("dijkstraBtn");
    if (dijBtn) dijBtn.addEventListener("click", () => this.showDijkstraDialog());
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.addEventListener("click", () => this.saveToFile());
    const loadBtn = document.getElementById("loadBtn");
    if (loadBtn) loadBtn.addEventListener("click", () => document.getElementById('fileInput').click());
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.addEventListener('change', (e) => this.loadFromFile(e));

        //interacciones con el canvas.
        this.canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
        this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));

        //botones de tareas.
        document.getElementById("saveTaskBtn").addEventListener("click", () => this.saveTask());
        document.getElementById("cancelTaskBtn").addEventListener("click", () => this.closeTaskModal());

        //botones de dependencias.
        document.getElementById("saveDependencyBtn").addEventListener("click", () => this.saveDependency());
        document.getElementById("cancelDependencyBtn").addEventListener("click", () => this.closeDependencyModal());

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.closeTaskModal();
                this.closeDependencyModal();
            }
        });

        // Escuchador de evento para cerrar modales al hacer clic fuera de ellos.
        window.addEventListener("click", (e) => {
            if (e.target.classList.contains("modal")) {
                this.closeTaskModal();
                this.closeDependencyModal();
            }
        });

        // Result modal close (if present)
        const closeResultBtn = document.getElementById('closeResultBtn');
        if (closeResultBtn) closeResultBtn.addEventListener('click', () => document.getElementById('resultModal').style.display = 'none');

        // Escuchador de evento para seleccionar tareas desde la lista lateral.
        document.getElementById("taskList").addEventListener("click", (e) => {
            const taskItem = e.target.closest(".task-item"); // Encuentra el elemento de la tarea más cercano.
            if (taskItem) {
                const taskId = parseInt(taskItem.dataset.taskId); // Obtiene el ID de la tarea.
                this.selectTaskFromList(taskId); // Selecciona la tarea en el canvas.
            }
        });
    }

    // Establece el modo actual de la aplicación y actualiza la interfaz.
    setMode(newMode) {
        this.mode = newMode; // Actualiza el modo.
        this.selectedTask = null; // Deselecciona cualquier tarea.
        this.selectedDependency = null; // Deselecciona cualquier dependencia.
        this.dependencyStart = null; // Reinicia el inicio de la dependencia.

        // Remueve la clase 'active' de todos los botones y la agrega al botón del modo actual.
        document.querySelectorAll(".btn").forEach(btn => btn.classList.remove("active"));
        
        const instructions = document.querySelector(".instructions"); // Obtiene el elemento de instrucciones.
        
        // Actualiza las instrucciones y el cursor del canvas según el modo.
        switch(newMode) {
            case "addTask":
                document.getElementById("addTaskBtn").classList.add("active");
                this.canvas.style.cursor = "crosshair";
                instructions.innerHTML = "<strong>Modo Agregar Tarea:</strong> Haz clic en cualquier lugar del canvas para crear una nueva tarea";
                break;
            case "addDependency":
                document.getElementById("addDependencyBtn").classList.add("active");
                this.canvas.style.cursor = "pointer";
                instructions.innerHTML = "<strong>Modo Agregar Dependencia:</strong> Haz clic en una tarea y luego en otra para crear una dependencia";
                break;
            case "edit":
                document.getElementById("editBtn").classList.add("active");
                this.canvas.style.cursor = "pointer";
                instructions.innerHTML = "<strong>Modo Editar:</strong> Haz clic en una tarea o dependencia para editarla, o arrastra tareas para moverlas";
                break;
            case "delete":
                document.getElementById("deleteBtn").classList.add("active");
                this.canvas.style.cursor = "pointer";
                instructions.innerHTML = "<strong>Modo Eliminar:</strong> Haz clic en una tarea o dependencia para eliminarla";
                break;
        }

        this.updateInfo(); // Actualiza la información del resumen.
        this.draw(); // Redibuja el grafo.
    }

    // Obtiene la posición del ratón relativa al canvas.
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect(); // Obtiene el tamaño y posición del canvas.
        return {
            x: e.clientX - rect.left, // Calcula la coordenada X.
            y: e.clientY - rect.top // Calcula la coordenada Y.
        };
    }

    // Encuentra una tarea en una posición dada (x, y).
    findTaskAt(x, y) {
        return this.tasks.find(task => { // Itera sobre todas las tareas.
            // Comprueba si las coordenadas (x, y) están dentro de los límites de la tarea.
            return x >= task.x - task.width/2 && x <= task.x + task.width/2 &&
                   y >= task.y - task.height/2 && y <= task.y + task.height/2;
        });
    }

    // Encuentra una dependencia en una posición dada (x, y).
    findDependencyAt(x, y) {
        const tolerance = 12;
        // Buscar la dependencia más cercana (si hay varias, priorizar la más cercana)
        let minDist = Infinity;
        let foundDep = null;
        this.dependencies.forEach(dep => {
            const task1 = this.tasks.find(t => t.id === dep.from);
            const task2 = this.tasks.find(t => t.id === dep.to);
            if (!task1 || !task2) return;
            const dist = this.distanceToLine(x, y, task1.x, task1.y, task2.x, task2.y);
            if (dist <= tolerance && dist < minDist) {
                minDist = dist;
                foundDep = dep;
            }
        });
        return foundDep;
    }

    // Calcula la distancia de un punto (px, py) a un segmento de línea (x1, y1) a (x2, y2).
    distanceToLine(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D; // Producto punto.
        const lenSq = C * C + D * D; // Longitud al cuadrado del segmento.
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B); // Si el segmento es un punto, calcula la distancia al punto.

        // Calcula el parámetro 'param' que indica la proyección del punto sobre la línea.
        const param = Math.max(0, Math.min(1, dot / lenSq));
        // Calcula las coordenadas del punto más cercano en el segmento.
        const xx = x1 + param * C;
        const yy = y1 + param * D;

        // Calcula la distancia euclidiana entre el punto y su proyección.
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Maneja los clics en el canvas según el modo actual.
    handleCanvasClick(e) {
        const pos = this.getMousePos(e);
        const clickedTask = this.findTaskAt(pos.x, pos.y);
        const clickedDependency = this.findDependencyAt(pos.x, pos.y);
        switch(this.mode) {
            case "addTask":
                if (!clickedTask) {
                    this.pendingTaskPos = pos;
                    this.showTaskModal();
                }
                break;
            case "addDependency":
                if (clickedTask) {
                    if (!this.dependencyStart) {
                        this.dependencyStart = clickedTask;
                        this.selectedTask = clickedTask;
                    } else if (this.dependencyStart !== clickedTask) {
                        this.pendingDependencyData = {
                            from: this.dependencyStart,
                            to: clickedTask
                        };
                        this.showDependencyModal();
                        this.dependencyStart = null;
                        this.selectedTask = null;
                    }
                } else {
                    this.dependencyStart = null;
                    this.selectedTask = null;
                }
                break;
            case "edit":
                if (clickedTask) {
                    this.editTask(clickedTask);
                } else if (clickedDependency) {
                    this.selectedDependency = clickedDependency;
                    this.showDependencyModal(clickedDependency);
                }
                break;
            case "delete":
                if (clickedTask) {
                    this.deleteTask(clickedTask.id);
                } else if (clickedDependency) {
                    this.deleteDependency(clickedDependency);
                }
                break;
        }
        this.draw();
    }

    // Maneja el evento de presionar el botón del ratón (mousedown).
    handleMouseDown(e) {
        if (this.mode === "edit") { // Solo en modo edición.
            const pos = this.getMousePos(e); // Obtiene la posición del ratón.
            const clickedTask = this.findTaskAt(pos.x, pos.y); // Encuentra si se hizo clic en una tarea.
            
            if (clickedTask) {
                this.draggedTask = clickedTask; // Establece la tarea a arrastrar.
                this.isDragging = true; // Activa la bandera de arrastre.
                this.dragOffset.x = pos.x - clickedTask.x; // Calcula el offset X.
                this.dragOffset.y = pos.y - clickedTask.y; // Calcula el offset Y.
                this.canvas.style.cursor = "grabbing"; // Cambia el cursor a "grabbing".
                e.preventDefault(); // Previene el comportamiento por defecto del navegador.
            }
        }
    }

    // Maneja el evento de mover el ratón (mousemove).
    handleMouseMove(e) {
        const pos = this.getMousePos(e); // Obtiene la posición actual del ratón.
        
        if (this.isDragging && this.draggedTask) { // Si se está arrastrando una tarea.
            this.draggedTask.x = pos.x - this.dragOffset.x; // Actualiza la posición X de la tarea.
            this.draggedTask.y = pos.y - this.dragOffset.y; // Actualiza la posición Y de la tarea.
            this.draw(); // Redibuja el grafo.
            e.preventDefault(); // Previene el comportamiento por defecto del navegador.
        } else if (this.mode === "addDependency") { // Si está en modo agregar dependencia.
            this.mousePos = pos; // Guarda la posición del ratón para dibujar la línea temporal.
            this.draw(); // Redibuja el grafo.
        }
    }

    // Maneja el evento de soltar el botón del ratón (mouseup).
    handleMouseUp(e) {
        if (this.isDragging) { // Si se estaba arrastrando una tarea.
            this.isDragging = false; // Desactiva la bandera de arrastre.
            this.draggedTask = null; // Reinicia la tarea arrastrada.
            this.canvas.style.cursor = "pointer"; // Restaura el cursor.
        }
    }

    // Muestra el modal para crear o editar tareas.
    showTaskModal(task = null) {
        const modal = document.getElementById("taskModal"); // Obtiene el elemento del modal.
        const title = document.getElementById("taskModalTitle"); // Obtiene el título del modal.

        if (task) {
            // Si se pasa una tarea, se está editando una existente.
            title.textContent = "Editar Tarea";
            document.getElementById("taskName").value = task.name || "";
            document.getElementById("taskDescription").value = task.description || "";
            document.getElementById("taskDuration").value = task.duration || "";
            document.getElementById("taskCost").value = task.cost || "";
            document.getElementById("taskColor").value = task.color;
            document.getElementById("taskPriority").value = task.priority || "medium";
            this.selectedTask = task; // Establece la tarea seleccionada.
        } else {
            // Si no se pasa una tarea, se está creando una nueva.
            title.textContent = "Crear Nueva Tarea";
            document.getElementById("taskName").value = "";
            document.getElementById("taskDescription").value = "";
            document.getElementById("taskDuration").value = "";
            document.getElementById("taskCost").value = "";
            document.getElementById("taskColor").value = "#3498db";
            document.getElementById("taskPriority").value = "medium";
            this.selectedTask = null; // No hay tarea seleccionada al crear una nueva.
        }

        this.updatePrerequisitesLists(); // Actualiza las listas de prerrequisitos y postrequisitos.
        modal.style.display = "block"; // Muestra el modal.
        document.getElementById("taskName").focus(); // Pone el foco en el campo de nombre de la tarea.
    }

    // Cierra el modal de tareas.
    closeTaskModal() {
        document.getElementById("taskModal").style.display = "none"; // Oculta el modal.
        this.selectedTask = null; // Deselecciona la tarea.
        this.pendingTaskPos = null; // Reinicia la posición pendiente.
    }

    // Actualiza las listas de prerrequisitos y postrequisitos en el modal de tareas.
    updatePrerequisitesLists() {
        const prerequisitesList = document.getElementById("prerequisitesList");
        const postrequisitesList = document.getElementById("postrequisitesList");
        
        prerequisitesList.innerHTML = ""; // Limpia la lista de prerrequisitos.
        postrequisitesList.innerHTML = ""; // Limpia la lista de postrequisitos.

        const currentTaskId = this.selectedTask ? this.selectedTask.id : null; // Obtiene el ID de la tarea actual (si existe).

        this.tasks.forEach(task => {
            if (task.id === currentTaskId) return; // No muestra la tarea actual como prerrequisito/postrequisito de sí misma.

            // Sección para prerrequisitos.
            const preDiv = document.createElement("div");
            preDiv.className = "checkbox-item";
            
            const preCheckbox = document.createElement("input");
            preCheckbox.type = "checkbox";
            preCheckbox.value = task.id;
            preCheckbox.id = `pre_${task.id}`;
            
            if (this.selectedTask) {
                // Marca el checkbox si ya existe una dependencia de la tarea iterada a la tarea seleccionada.
                const existingDep = this.dependencies.find(dep => 
                    dep.from === task.id && dep.to === this.selectedTask.id
                );
                preCheckbox.checked = !!existingDep;
            }
            
            const preLabel = document.createElement("label");
            preLabel.htmlFor = `pre_${task.id}`;
            preLabel.textContent = task.name;
            
            preDiv.appendChild(preCheckbox);
            preDiv.appendChild(preLabel);
            prerequisitesList.appendChild(preDiv);

            // Sección para postrequisitos.
            const postDiv = document.createElement("div");
            postDiv.className = "checkbox-item";
            
            const postCheckbox = document.createElement("input");
            postCheckbox.type = "checkbox";
            postCheckbox.value = task.id;
            postCheckbox.id = `post_${task.id}`;
            
            if (this.selectedTask) {
                // Marca el checkbox si ya existe una dependencia de la tarea seleccionada a la tarea iterada.
                const existingDep = this.dependencies.find(dep => 
                    dep.from === this.selectedTask.id && dep.to === task.id
                );
                postCheckbox.checked = !!existingDep;
            }
            
            const postLabel = document.createElement("label");
            postLabel.htmlFor = `post_${task.id}`;
            postLabel.textContent = task.name;
            
            postDiv.appendChild(postCheckbox);
            postDiv.appendChild(postLabel);
            postrequisitesList.appendChild(postDiv);
        });

        // Muestra un mensaje si no hay otras tareas disponibles para prerrequisitos/postrequisitos.
        if (this.tasks.length === 0 || (this.tasks.length === 1 && this.selectedTask)) {
            prerequisitesList.innerHTML = "<div style=\"padding: 10px; color: #666; text-align: center;\">No hay otras tareas disponibles</div>";
            postrequisitesList.innerHTML = "<div style=\"padding: 10px; color: #666; text-align: center;\">No hay otras tareas disponibles</div>";
        }
    }

    // Guarda una tarea (crea una nueva o edita una existente).
    saveTask() {
        // Obtiene los valores de los campos del formulario.
        const name = document.getElementById("taskName").value.trim();
        const description = document.getElementById("taskDescription").value.trim();
        const duration = parseFloat(document.getElementById("taskDuration").value);
        const cost = parseFloat(document.getElementById("taskCost").value) || 0;
        const color = document.getElementById("taskColor").value;
        const priority = document.getElementById("taskPriority").value;

        // Validaciones de campos.
        if (!name) {
            alert("Por favor, ingresa un nombre para la tarea");
            return;
        }

        if (!duration || duration <= 0) {
            alert("Por favor, ingresa una duración válida para la tarea");
            return;
        }

        // Verifica que el nombre de la tarea sea único (excepto si es la misma tarea que se está editando).
        if (this.tasks.some(t => t.name === name && t.id !== (this.selectedTask?.id || -1))) {
            alert("Ya existe una tarea con ese nombre. Por favor, usa un nombre diferente.");
            return;
        }

        if (this.selectedTask) {
            // Si hay una tarea seleccionada, se edita.
            this.selectedTask.name = name;
            this.selectedTask.description = description;
            this.selectedTask.duration = duration;
            this.selectedTask.cost = cost;
            this.selectedTask.color = color;
            this.selectedTask.priority = priority;
            this.selectedTask.width = Math.max(120, name.length * 8 + 20); // Ajusta el ancho de la tarea.
        } else if (this.pendingTaskPos) {
            // Si no hay tarea seleccionada y hay una posición pendiente, se crea una nueva tarea.
            const task = {
                id: this.taskIdCounter++, // Asigna un ID único.
                x: this.pendingTaskPos.x,
                y: this.pendingTaskPos.y,
                width: Math.max(120, name.length * 8 + 20),
                height: 80,
                name: name,
                description: description,
                duration: duration,
                cost: cost,
                color: color,
                priority: priority
            };
            
            this.tasks.push(task); // Agrega la nueva tarea al array.
        }

        // Actualiza las dependencias basadas en los checkboxes de prerrequisitos y postrequisitos del modal.
        this.updateDependenciesFromModal();

        this.closeTaskModal(); // Cierra el modal.
        this.updateInfo(); // Actualiza la información del resumen.
        this.updateTaskList(); // Actualiza la lista de tareas.
        this.draw(); // Redibuja el grafo.
    }

    // Actualiza las dependencias basándose en las selecciones de prerrequisitos y postrequisitos en el modal.
    updateDependenciesFromModal() {
        if (!this.selectedTask) return; // Si no hay tarea seleccionada, no hace nada.

        // Procesa los prerrequisitos seleccionados.
        const preCheckboxes = document.querySelectorAll("#prerequisitesList input[type=\"checkbox\"]");
        preCheckboxes.forEach(checkbox => {
            const fromTaskId = parseInt(checkbox.value);
            const toTaskId = this.selectedTask.id;
            const existingDep = this.dependencies.find(dep => dep.from === fromTaskId && dep.to === toTaskId); // Busca una dependencia existente.

            if (checkbox.checked && !existingDep) {
                // Si el checkbox está marcado y no existe la dependencia, la crea.
                const fromTask = this.tasks.find(t => t.id === fromTaskId);
                const dependency = {
                    id: this.dependencyIdCounter++,
                    from: fromTaskId,
                    to: toTaskId,
                    name: `${fromTask.name} → ${this.selectedTask.name}`,
                    type: "FS", // Por defecto, Fin-a-Inicio.
                    lag: 0,
                    weight: 1 // Default weight
                };
                this.dependencies.push(dependency);
            } else if (!checkbox.checked && existingDep) {
                // Si el checkbox no está marcado y existe la dependencia, la elimina.
                this.dependencies = this.dependencies.filter(dep => dep.id !== existingDep.id);
            }
        });

        // Procesa los postrequisitos seleccionados.
        const postCheckboxes = document.querySelectorAll("#postrequisitesList input[type=\"checkbox\"]");
        postCheckboxes.forEach(checkbox => {
            const fromTaskId = this.selectedTask.id;
            const toTaskId = parseInt(checkbox.value);
            const existingDep = this.dependencies.find(dep => dep.from === fromTaskId && dep.to === toTaskId); // Busca una dependencia existente.

            if (checkbox.checked && !existingDep) {
                // Si el checkbox está marcado y no existe la dependencia, la crea.
                const toTask = this.tasks.find(t => t.id === toTaskId);
                const dependency = {
                    id: this.dependencyIdCounter++,
                    from: fromTaskId,
                    to: toTaskId,
                    name: `${this.selectedTask.name} → ${toTask.name}`,
                    type: "FS", // Por defecto, Fin-a-Inicio.
                    lag: 0,
                    weight: 1 // Default weight
                };
                this.dependencies.push(dependency);
            } else if (!checkbox.checked && existingDep) {
                // Si el checkbox no está marcado y existe la dependencia, la elimina.
                this.dependencies = this.dependencies.filter(dep => dep.id !== existingDep.id);
            }
        });
    }

    // Muestra el modal para crear o editar dependencias.
    showDependencyModal(dependency = null) {
        const modal = document.getElementById("dependencyModal");
        const title = document.getElementById("dependencyModalTitle");

        // Botón para eliminar dependencia (solo en edición)
        let deleteBtn = document.getElementById("deleteDependencyBtn");
        if (!deleteBtn) {
            deleteBtn = document.createElement("button");
            deleteBtn.id = "deleteDependencyBtn";
            deleteBtn.className = "btn delete";
            deleteBtn.textContent = "Eliminar";
            deleteBtn.style.marginLeft = "10px";
            deleteBtn.addEventListener("click", () => {
                if (this.selectedDependency) {
                    this.deleteDependency(this.selectedDependency);
                    this.closeDependencyModal();
                }
            });
            // Insertar el botón en el modal solo si no existe
            const modalButtons = modal.querySelector('.modal-buttons');
            if (modalButtons) {
                modalButtons.appendChild(deleteBtn);
            }
        }
        // Mostrar u ocultar el botón según si es edición
        if (dependency) {
            deleteBtn.style.display = "inline-block";
        } else {
            deleteBtn.style.display = "none";
        }

        if (dependency) {
            title.textContent = "Editar Dependencia";
            document.getElementById("dependencyName").value = dependency.name || "";
            document.getElementById("dependencyType").value = dependency.type || "FS";
            document.getElementById("dependencyLag").value = dependency.lag || 0;
            this.selectedDependency = dependency;
        } else if (this.pendingDependencyData) {
            title.textContent = "Crear Dependencia";
            const fromTask = this.pendingDependencyData.from;
            const toTask = this.pendingDependencyData.to;
            document.getElementById("dependencyName").value = `${fromTask.name} → ${toTask.name}`;
            document.getElementById("dependencyType").value = "FS";
            document.getElementById("dependencyLag").value = 0;
            this.selectedDependency = null;
        }
        modal.style.display = "block";
        document.getElementById("dependencyName").focus();
    }

    // Cierra el modal de dependencias.
    closeDependencyModal() {
        document.getElementById("dependencyModal").style.display = "none"; // Oculta el modal.
        this.selectedDependency = null; // Deselecciona la dependencia.
        this.pendingDependencyData = null; // Reinicia los datos pendientes.
    }

    // Guarda una dependencia (crea una nueva o edita una existente).
    saveDependency() {
        // Obtiene los valores de los campos del formulario.
        const name = document.getElementById("dependencyName").value.trim();
        const type = document.getElementById("dependencyType").value;
        // Permitir string o número para lag
        let lagRaw = document.getElementById("dependencyLag").value;
        let lag = lagRaw;
        if (!isNaN(lagRaw) && lagRaw !== "") {
            lag = parseFloat(lagRaw);
        }
        // Default weight is 1 if lag is 0 or empty, otherwise use lag as weight
        const weight = (lag && lag !== 0) ? Math.abs(lag) : 1;

        // Validación del nombre.
        if (!name) {
            alert("Por favor, ingresa un nombre para la dependencia");
            return;
        }

        if (this.selectedDependency) {
            // Si hay una dependencia seleccionada, se edita.
            this.selectedDependency.name = name;
            this.selectedDependency.type = type;
            this.selectedDependency.lag = lag;
            this.selectedDependency.weight = weight;
        } else if (this.pendingDependencyData) {
            // Si no hay dependencia seleccionada y hay datos pendientes, se crea una nueva.
            // Verifica si ya existe una dependencia entre las tareas seleccionadas.
            const existingDep = this.dependencies.find(dep => 
                (dep.from === this.pendingDependencyData.from.id && dep.to === this.pendingDependencyData.to.id) || 
                (dep.from === this.pendingDependencyData.to.id && dep.to === this.pendingDependencyData.from.id)
            );
            if (!existingDep) {
                // Si no existe, crea la nueva dependencia.
                const dependency = {
                    id: this.dependencyIdCounter++,
                    from: this.pendingDependencyData.from.id,
                    to: this.pendingDependencyData.to.id,
                    name: name,
                    type: type,
                    lag: lag,
                    weight: weight
                };
                this.dependencies.push(dependency);
            } else {
                alert("Ya existe una dependencia entre estas tareas");
            }
        }
        this.closeDependencyModal();
        this.updateInfo();
        this.updateTaskList();
        this.draw();
    }

    // Abre el modal de tareas para editar una tarea existente.
    editTask(task) {
        this.showTaskModal(task);
    }

    // Abre el modal de dependencias para editar una dependencia existente.
    editDependency(dependency) {
        this.showDependencyModal(dependency);
    }

    // Elimina una tarea y todas sus dependencias asociadas.
    deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId); // Encuentra la tarea por su ID.
        if (task && confirm(`¿Eliminar la tarea "${task.name}" y todas sus dependencias?`)) { // Pide confirmación.
            this.tasks = this.tasks.filter(task => task.id !== taskId); // Filtra la tarea a eliminar.
            this.dependencies = this.dependencies.filter(dep => dep.from !== taskId && dep.to !== taskId); // Filtra las dependencias asociadas.
            this.updateInfo(); // Actualiza la información del resumen.
            this.updateTaskList(); // Actualiza la lista de tareas.
        }
    }

    // Elimina una dependencia específica.
    deleteDependency(dependency) {
        if (confirm(`¿Eliminar la dependencia "${dependency.name}"?`)) { // Pide confirmación.
            this.dependencies = this.dependencies.filter(dep => dep.id !== dependency.id); // Filtra la dependencia a eliminar.
            this.updateInfo(); // Actualiza la información del resumen.
            this.updateTaskList(); // Actualiza la lista de tareas.
        }
    }

    // Elimina todas las tareas y dependencias del grafo.
    clearAll() {
        if (this.tasks.length > 0 || this.dependencies.length > 0) { // Solo si hay elementos para borrar.
            if (confirm("¿Estás seguro de que quieres eliminar todas las tareas y dependencias?")) { // Pide confirmación.
                this.tasks = []; // Vacía el array de tareas.
                this.dependencies = []; // Vacía el array de dependencias.
                this.selectedTask = null;
                this.selectedDependency = null;
                this.dependencyStart = null;
                this.taskIdCounter = 1; // Reinicia el contador de IDs de tareas.
                this.dependencyIdCounter = 1; // Reinicia el contador de IDs de dependencias.
                this.updateInfo(); // Actualiza la información del resumen.
                this.updateTaskList(); // Actualiza la lista de tareas.
                this.draw(); // Redibuja el grafo.
            }
        }
    }

    // Alterna la visibilidad de la ruta crítica.
    toggleCriticalPath() {
        this.showCriticalPath = !this.showCriticalPath; // Cambia el estado de visibilidad.
        if (this.showCriticalPath) {
            this.computeCriticalPathCPM(); // Calcula la ruta crítica si se va a mostrar.
            document.getElementById("criticalPathBtn").textContent = "🎯 Ocultar Ruta Crítica"; // Cambia el texto del botón.
        } else {
            this.criticalPathTasks = []; // Limpia las tareas de la ruta crítica si se oculta.
            document.getElementById("criticalPathBtn").textContent = "🎯 Ruta Crítica"; // Restaura el texto del botón.
        }
        this.draw(); // Redibuja el grafo.
    }

    // Calcula una ruta crítica simplificada (solo tareas con la mayor duración).
    calculateCriticalPath() {
        // Implementación simplificada de cálculo de ruta crítica.
        // En una implementación real, se usaría el método CPM (Critical Path Method) para un cálculo preciso.
        this.criticalPathTasks = [];
        
        // Por simplicidad, considera como críticas las tareas con la mayor duración.
        const maxDuration = Math.max(...this.tasks.map(t => t.duration)); // Encuentra la duración máxima.
        this.criticalPathTasks = this.tasks.filter(t => t.duration === maxDuration).map(t => t.id); // Filtra las tareas con esa duración.
    }

    // Build adjacency matrix (tasks x tasks) using edge weights from dependencies
    buildAdjacencyMatrix() {
        const n = this.tasks.length;
        const idx = {};
        this.tasks.forEach((t, i) => idx[t.id] = i);
        const mat = Array.from({ length: n }, () => Array(n).fill(0));
        this.dependencies.forEach(dep => {
            const i = idx[dep.from];
            const j = idx[dep.to];
            if (i === undefined || j === undefined) return;
            // Use dependency weight (based on lag, default 1)
            const w = dep.weight || 1;
            mat[i][j] = w;
        });
        return { mat, indexMap: idx };
    }

    // Build incidence matrix (tasks x dependencies) with weights
    buildIncidenceMatrix() {
        const n = this.tasks.length;
        const m = this.dependencies.length;
        const idx = {};
        this.tasks.forEach((t, i) => idx[t.id] = i);
        const mat = Array.from({ length: n }, () => Array(m).fill(0));
        this.dependencies.forEach((dep, j) => {
            const iFrom = idx[dep.from];
            const iTo = idx[dep.to];
            const weight = dep.weight || 1;
            // Use weight: -weight for source, +weight for target
            if (iFrom !== undefined) mat[iFrom][j] = -weight;
            if (iTo !== undefined) mat[iTo][j] = weight;
        });
        return { mat, indexMap: idx };
    }

    // Show adjacency matrix in result modal
    showAdjacencyMatrix() {
        const { mat, indexMap } = this.buildAdjacencyMatrix();
        const ids = Object.keys(indexMap).sort((a,b) => indexMap[a]-indexMap[b]);
        let html = '<table style="border-collapse:collapse; font-size:13px;">';
        html += '<tr><th></th>' + ids.map(id=>'<th style="border:1px solid #ccc;padding:4px;">'+this.tasks[indexMap[id]].name+'</th>').join('') + '</tr>';
        mat.forEach((row,i)=>{
            html += '<tr><th style="border:1px solid #ccc;padding:4px;">'+this.tasks[i].name+'</th>' + row.map(v=>'<td style="border:1px solid #ddd;padding:4px;text-align:center">'+v+'</td>').join('') + '</tr>';
        });
        html += '</table>';
        this.showResultModal('Matriz de Adyacencia', html);
    }

    // Show incidence matrix in modal
    showIncidenceMatrix() {
        const { mat } = this.buildIncidenceMatrix();
        let html = '<table style="border-collapse:collapse; font-size:13px;">';
        html += '<tr><th></th>' + this.dependencies.map(d=>'<th style="border:1px solid #ccc;padding:4px">'+d.name+'</th>').join('') + '</tr>';
        mat.forEach((row,i)=>{
            html += '<tr><th style="border:1px solid #ccc;padding:4px">'+this.tasks[i].name+'</th>' + row.map(v=>'<td style="border:1px solid #ddd;padding:4px;text-align:center">'+v+'</td>').join('') + '</tr>';
        });
        html += '</table>';
        this.showResultModal('Matriz de Incidencia', html);
    }

    showResultModal(title, html) {
        const modal = document.getElementById('resultModal');
        if (!modal) return alert('No hay modal de resultados en el HTML');
        document.getElementById('resultModalTitle').textContent = title;
        document.getElementById('resultContent').innerHTML = html;
        modal.style.display = 'block';
    }

    // Dijkstra: provide dialog to pick source/destination and then run
    showDijkstraDialog() {
        if (this.tasks.length === 0) return alert('No hay tareas en el grafo');
        // Build simple prompt form in modal
        let html = '<div style="display:flex;gap:8px;align-items:center;">';
        html += '<div><label>Origen</label><br><select id="dijSource">' + this.tasks.map(t=>`<option value="${t.id}">${t.name}</option>`).join('') + '</select></div>';
        html += '<div><label>Destino</label><br><select id="dijTarget">' + this.tasks.map(t=>`<option value="${t.id}">${t.name}</option>`).join('') + '</select></div>';
        html += '</div><div style="margin-top:10px;text-align:center;"><button class="btn" id="runDijBtn">Calcular Ruta</button></div>';
        this.showResultModal('Ruta Mínima (Dijkstra)', html);
        document.getElementById('runDijBtn').addEventListener('click', () => {
            const s = parseInt(document.getElementById('dijSource').value);
            const t = parseInt(document.getElementById('dijTarget').value);
            document.getElementById('resultModal').style.display = 'none';
            this.runDijkstra(s, t);
        });
    }

    // Run Dijkstra using edge weights from dependencies
    runDijkstra(sourceId, targetId) {
        // Build adjacency list with weights from dependencies
        const nodes = this.tasks.map(t=>t.id);
        const adj = {};
        this.tasks.forEach(t=> adj[t.id]=[]);
        this.dependencies.forEach(dep=>{
            // Use dependency weight instead of task duration
            const w = dep.weight || 1;
            adj[dep.from].push({to: dep.to, weight: w, depId: dep.id});
        });

        // Dijkstra
        const dist = {};
        const prev = {};
        const prevEdge = {};
        const Q = new Set(nodes);
        nodes.forEach(v=>{ dist[v]=Infinity; prev[v]=null; });
        dist[sourceId]=0;
        while (Q.size>0) {
            let u = null;
            let best = Infinity;
            Q.forEach(v=>{ if (dist[v]<best) { best=dist[v]; u=v; } });
            if (u===null) break;
            Q.delete(u);
            if (u===targetId) break;
            adj[u].forEach(e=>{
                const alt = dist[u] + e.weight;
                if (alt < dist[e.to]) { dist[e.to]=alt; prev[e.to]=u; prevEdge[e.to]=e.depId; }
            });
        }

        if (dist[targetId]===Infinity) {
            this.showResultModal('Ruta Mínima - Resultado', `<div>No existe ruta desde ${this.tasks.find(t=>t.id===sourceId)?.name} hasta ${this.tasks.find(t=>t.id===targetId)?.name}</div>`);
            return;
        }

        // Reconstruct path
        const pathNodes = [];
        const pathEdges = [];
        let cur = targetId;
        while (cur !== null) {
            pathNodes.unshift(cur);
            if (prevEdge[cur]) pathEdges.unshift(prevEdge[cur]);
            cur = prev[cur];
        }

        // Mark for drawing
        this.highlightedPath = { nodes: pathNodes, edges: pathEdges };
        this.draw();

        // Show textual result
        const names = pathNodes.map(id=>this.tasks.find(t=>t.id===id)?.name || id);
        const html = `<div>Distancia total (suma de pesos): <strong>${dist[targetId]}</strong></div>` +
            `<div>Ruta: ${names.join(' → ')}</div>`;
        this.showResultModal('Ruta Mínima - Resultado', html);
    }

    // Save graph as JSON file (download)
    saveToFile() {
        const data = {
            tasks: this.tasks,
            dependencies: this.dependencies
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'graph.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Load graph from file input change event
    loadFromFile(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const obj = JSON.parse(ev.target.result);
                if (obj.tasks && obj.dependencies) {
                    // Basic validation and restore
                    this.tasks = obj.tasks.map(t=>({
                        id: t.id,
                        x: t.x || 100,
                        y: t.y || 100,
                        width: t.width || Math.max(120, (t.name||'').length*8+20),
                        height: t.height || 80,
                        name: t.name || 'Tarea',
                        description: t.description || '',
                        duration: t.duration || 1,
                        cost: t.cost || 0,
                        color: t.color || '#3498db',
                        priority: t.priority || 'medium'
                    }));
                    this.dependencies = obj.dependencies.map(d=>{
                        const lag = d.lag || 0;
                        const weight = d.weight || ((lag && lag !== 0) ? Math.abs(lag) : 1);
                        return {
                            id: d.id,
                            from: d.from,
                            to: d.to,
                            name: d.name || '',
                            type: d.type || 'FS',
                            lag: lag,
                            weight: weight
                        };
                    });
                    // Reset counters
                    this.taskIdCounter = this.tasks.reduce((m,t)=>Math.max(m,t.id), 0) + 1;
                    this.dependencyIdCounter = this.dependencies.reduce((m,d)=>Math.max(m,d.id), 0) + 1;
                    this.updateInfo();
                    this.updateTaskList();
                    this.draw();
                } else {
                    alert('Archivo JSON inválido');
                }
            } catch(err) {
                alert('Error leyendo archivo: ' + err.message);
            }
        };
        reader.readAsText(file);
        // clear input
        e.target.value = '';
    }

    // Compute critical path using CPM on DAG (longest path), considering durations
    computeCriticalPathCPM() {
        // Build adjacency list
        const idx = {};
        this.tasks.forEach((t,i)=> idx[t.id]=i);
        const adj = {};
        this.tasks.forEach(t=> adj[t.id]=[]);
        this.dependencies.forEach(d=> { if (adj[d.from]) adj[d.from].push(d.to); });

        // Topological sort
        const inDeg = {};
        this.tasks.forEach(t=> inDeg[t.id]=0);
        this.dependencies.forEach(d=> { inDeg[d.to] = (inDeg[d.to]||0)+1; });
        const q = [];
        this.tasks.forEach(t=> { if ((inDeg[t.id]||0)===0) q.push(t.id); });
        const topo = [];
        while (q.length) {
            const u = q.shift(); topo.push(u);
            (adj[u]||[]).forEach(v=>{ inDeg[v]--; if (inDeg[v]===0) q.push(v); });
        }
        // Longest path DP
        const dist = {};
        const prev = {};
        this.tasks.forEach(t=> { dist[t.id] = -Infinity; prev[t.id]=null; });
        // source nodes have their own duration as starting
        topo.forEach(u=>{ if (this.dependencies.find(d=>d.to===u)===undefined) dist[u]=this.tasks.find(t=>t.id===u).duration; });
        topo.forEach(u=>{
            (adj[u]||[]).forEach(v=>{
                const durV = this.tasks.find(t=>t.id===v).duration;
                if (dist[u] + durV > dist[v]) { dist[v] = dist[u] + durV; prev[v]=u; }
            });
        });
        // find max
        let maxNode = null; let maxVal = -Infinity;
        Object.keys(dist).forEach(k=>{ if (dist[k] > maxVal) { maxVal = dist[k]; maxNode = parseInt(k); } });
        // reconstruct path
        const path = [];
        let cur = maxNode;
        while (cur) { path.unshift(cur); cur = prev[cur]; }
        this.criticalPathTasks = path;
    }


    // Selecciona una tarea desde la lista lateral.
    selectTaskFromList(taskId) {
        this.selectedTask = this.tasks.find(t => t.id === taskId); // Encuentra y selecciona la tarea.
        this.draw(); // Redibuja el grafo para resaltar la tarea seleccionada.
        this.updateTaskList(); // Actualiza la lista para reflejar la selección.
    }

    // Actualiza la información del resumen del proyecto (conteo de tareas, dependencias, duración y costo total).
    updateInfo() {
        document.getElementById("taskCount").textContent = this.tasks.length; // Actualiza el número de tareas.
        document.getElementById("dependencyCount").textContent = this.dependencies.length; // Actualiza el número de dependencias.
        
        const totalDuration = this.tasks.reduce((sum, task) => sum + task.duration, 0); // Calcula la duración total.
        document.getElementById("totalDuration").textContent = `${totalDuration} días`; // Muestra la duración total.
        
        const totalCost = this.tasks.reduce((sum, task) => sum + task.cost, 0); // Calcula el costo total.
        document.getElementById("totalCost").textContent = `$${totalCost.toLocaleString()}`; // Muestra el costo total formateado.
        
        // Mapeo de modos a nombres legibles.
        const modeNames = {
            "addTask": "Agregar Tarea",
            "addDependency": "Agregar Dependencia",
            "edit": "Editar",
            "delete": "Eliminar"
        };
        
        document.getElementById("currentMode").textContent = modeNames[this.mode]; // Muestra el modo actual.
    }

    // Actualiza la lista de tareas en la barra lateral.
    updateTaskList() {
        const taskList = document.getElementById("taskList");
        if (this.tasks.length === 0) {
            taskList.innerHTML = "<div style=\"padding: 20px; text-align: center; color: #666;\">No hay tareas creadas</div>";
            return;
        }
        taskList.innerHTML = "";
        this.tasks.forEach(task => {
            const taskDiv = document.createElement("div");
            taskDiv.className = "task-item";
            taskDiv.dataset.taskId = task.id;
            if (this.selectedTask && this.selectedTask.id === task.id) {
                taskDiv.classList.add("selected");
            }
            // Sin emojis
            taskDiv.innerHTML = `
                <div><strong>${task.name}</strong></div>
                <div class="task-details">
                    Duración: ${task.duration} días | Costo: $${task.cost.toLocaleString()}
                </div>
                ${task.description ? `<div class="task-details">${task.description}</div>` : ""}
            `;
            taskList.appendChild(taskDiv);
        });
    }

    // Dibuja todo el grafo en el canvas (tareas y dependencias).
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Limpia todo el canvas.

        // Dibuja las dependencias primero para que las tareas se superpongan.
        this.dependencies.forEach(dep => {
            const task1 = this.tasks.find(t => t.id === dep.from); // Obtiene la tarea de origen.
            const task2 = this.tasks.find(t => t.id === dep.to); // Obtiene la tarea de destino.
            
            if (task1 && task2) {
                this.drawDependency(task1, task2, dep, dep === this.selectedDependency); // Dibuja la dependencia.
            }
        });

        // Dibuja las tareas.
        this.tasks.forEach(task => {
            const isSelected = task === this.selectedTask || task === this.dependencyStart; // Determina si la tarea está seleccionada.
            const isCritical = this.showCriticalPath && this.criticalPathTasks.includes(task.id); // Determina si la tarea es crítica.
                const isInShortest = this.highlightedPath && this.highlightedPath.nodes && this.highlightedPath.nodes.includes(task.id);
                this.drawTask(task, isSelected, isCritical, isInShortest); // Dibuja la tarea.
        });

        // Dibuja una línea temporal para la creación de nuevas dependencias.
        if (this.mode === "addDependency" && this.dependencyStart && this.mousePos) {
            this.ctx.strokeStyle = "rgba(52, 152, 219, 0.6)"; // Color de la línea.
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([8, 8]); // Establece un patrón de línea discontinua.
            this.ctx.beginPath();
            this.ctx.moveTo(this.dependencyStart.x, this.dependencyStart.y); // Inicia en la tarea de origen.
            this.ctx.lineTo(this.mousePos.x, this.mousePos.y); // Termina en la posición actual del ratón.
            this.ctx.stroke();
            this.ctx.setLineDash([]); // Restaura el patrón de línea continua.
        }
    }

    // Dibuja una tarea individual en el canvas.
    drawTask(task, isSelected, isCritical, isInShortest) {
        // Configuración de sombra para la tarea.
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;

    // Dibuja el rectángulo de la tarea.
    const fillColor = isCritical ? "#e74c3c" : (isInShortest ? '#2ecc71' : task.color);
    this.ctx.fillStyle = fillColor; // Color de la tarea (rojo si es crítica, verde si parte de ruta mínima).
        this.ctx.fillRect(task.x - task.width/2, task.y - task.height/2, task.width, task.height);

        // Dibuja el borde de la tarea.
        if (isSelected) {
            this.ctx.strokeStyle = "#f39c12"; // Borde naranja si está seleccionada.
            this.ctx.lineWidth = 4;
        } else {
            this.ctx.strokeStyle = "#2c3e50"; // Borde oscuro por defecto.
            this.ctx.lineWidth = 2;
        }
        this.ctx.strokeRect(task.x - task.width/2, task.y - task.height/2, task.width, task.height);

        // Restablece la sombra para no afectar otros elementos.
        this.ctx.shadowColor = "transparent";

        // Dibuja el nombre de la tarea.
        this.ctx.fillStyle = "white";
        this.ctx.font = "bold 14px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        
        // Dibuja una sombra para el texto del nombre.
        this.ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(task.name, task.x, task.y - 15);
        this.ctx.fillText(task.name, task.x, task.y - 15);

        // Dibuja la información adicional (duración y costo).
        this.ctx.font = "11px Arial";
        const info = `${task.duration}d | $${task.cost}`;
        this.ctx.strokeText(info, task.x, task.y + 5);
        this.ctx.fillText(info, task.x, task.y + 5);

        // Dibuja el indicador de prioridad (un círculo de color).
        const priorityColors = {
            "low": "#27ae60",
            "medium": "#f39c12",
            "high": "#e67e22",
            "critical": "#c0392b"
        };

        this.ctx.fillStyle = priorityColors[task.priority] || "#f39c12";
        this.ctx.beginPath();
        this.ctx.arc(task.x + task.width/2 - 8, task.y - task.height/2 + 8, 5, 0, Math.PI * 2); // Dibuja el círculo.
        this.ctx.fill();
    }

    // Dibuja una dependencia (flecha) entre dos tareas.
    drawDependency(task1, task2, dependency, isSelected) {
        // Calcula la diferencia en coordenadas entre las tareas.
        const dx = task2.x - task1.x;
        const dy = task2.y - task1.y;
        const distance = Math.sqrt(dx * dx + dy * dy); // Calcula la distancia entre los centros.
        
        if (distance === 0) return; // Evita divisiones por cero si las tareas están en la misma posición.
        
        // Calcula los vectores unitarios.
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        // Calcula los puntos de inicio y fin de la línea de dependencia (ajustados a los bordes de las tareas).
        const startX = task1.x + unitX * task1.width/2;
        const startY = task1.y + unitY * task1.height/2;
        const endX = task2.x - unitX * task2.width/2;
        const endY = task2.y - unitY * task2.height/2;

        // Dibuja la línea de la dependencia.
        // If this dependency is part of the highlighted shortest path, color it green/blue
        const isInShortestEdge = this.highlightedPath && this.highlightedPath.edges && this.highlightedPath.edges.includes(dependency.id);
        if (isInShortestEdge) {
            this.ctx.strokeStyle = '#27ae60'; // green
            this.ctx.lineWidth = 4;
        } else {
            this.ctx.strokeStyle = isSelected ? "#f39c12" : "#34495e"; // Color de la línea (naranja si seleccionada).
            this.ctx.lineWidth = isSelected ? 3 : 2;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();

        // Dibuja la punta de flecha.
        const arrowLength = 12;
        const arrowAngle = Math.PI / 6; // Ángulo de las alas de la flecha.
        
        const angle = Math.atan2(dy, dx); // Ángulo de la línea.
        // Calcula los puntos de las alas de la flecha.
        const arrowX1 = endX - arrowLength * Math.cos(angle - arrowAngle);
        const arrowY1 = endY - arrowLength * Math.sin(angle - arrowAngle);
        const arrowX2 = endX - arrowLength * Math.cos(angle + arrowAngle);
        const arrowY2 = endY - arrowLength * Math.sin(angle + arrowAngle);

        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(arrowX1, arrowY1);
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(arrowX2, arrowY2);
        this.ctx.stroke();

        // Dibuja la etiqueta de la dependencia.
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        
        // Calcula un offset perpendicular para que la etiqueta no se superponga con la línea.
        const perpX = -unitY * 20;
        const perpY = unitX * 20;
        
        const textX = midX + perpX;
        const textY = midY + perpY;

        // Dibuja un fondo para el texto de la etiqueta.
        this.ctx.font = "10px Arial";
        const textWidth = this.ctx.measureText(dependency.name).width;
        const textHeight = 14;
        
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; // Fondo semitransparente.
        this.ctx.fillRect(textX - textWidth/2 - 3, textY - textHeight/2 - 2, textWidth + 6, textHeight + 4);
        
        // Dibuja un borde para el fondo del texto.
        this.ctx.strokeStyle = "#bdc3c7";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(textX - textWidth/2 - 3, textY - textHeight/2 - 2, textWidth + 6, textHeight + 4);
        
        // Dibuja el texto de la etiqueta.
        this.ctx.fillStyle = "#2c3e50";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(dependency.name, textX, textY);

        // Dibuja información adicional si hay un retraso (lag).
        if (dependency.lag && dependency.lag !== 0) {
            this.ctx.font = "8px Arial";
            this.ctx.fillStyle = "#e74c3c";
            this.ctx.fillText(`+${dependency.lag}d`, textX, textY + 10);
        }
    }
}

// Inicializa la aplicación cuando la página HTML ha cargado completamente.
document.addEventListener('DOMContentLoaded', () => {
    new ProjectGraphEditor();
});


