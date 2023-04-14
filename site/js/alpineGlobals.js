document.addEventListener("alpine:init", () => {
    Alpine.store("dropdown", {
        visible: false,
        selectedIndex: null,
        items: [],
        right: 0,
        top: 0,
        click: undefined,
        clickItem() {
            const dropdown = Alpine.store("dropdown");

            if (dropdown.selectedIndex !== null) {
                dropdown.click(dropdown.items[dropdown.selectedIndex]);
                dropdown.items = [];
                dropdown.visible = false;
                selectedIndex = null;
            }
        },
        selectNext() {
            const dropdown = Alpine.store("dropdown");

            if (dropdown.selectedIndex === null || dropdown.selectedIndex === dropdown.items.length - 1) {
                dropdown.selectedIndex = 0;
            } else {
                dropdown.selectedIndex++;
            }

            dropdown.focusSelected();
        },
        selectPrevious() {
            const dropdown = Alpine.store("dropdown");
            if (dropdown.selectedIndex === null || dropdown.selectedIndex === 0) {
                dropdown.selectedIndex = dropdown.items.length - 1;
            } else {
                dropdown.selectedIndex--;
            }
            dropdown.focusSelected();
        },
        focusSelected() {
            const dropdown = Alpine.store("dropdown");
            if (dropdown.items.length > 0) {
                const dropdownElement = document.getElementById('dropdown');
                dropdownElement.firstElementChild.children[dropdown.selectedIndex + 1].scrollIntoView({ block: "nearest" });
            }
        }
    });

    Alpine.store("loading", {
        loading: false,
    });

    Alpine.data("itemSearch", (dataName, synthesisOnly, submit) => ({
        itemSearch: "",
        items: [],
        dataName: dataName,
        synthesisOnly: synthesisOnly,
        submit: submit,

        async searchItem() {
            if (this.itemSearch === "") {
                this.items = [];
                Alpine.store("dropdown").items = this.items;
                return;
            }

            let url = `https://ryza-recipe-realiser.deno.dev/api/search/item/${this.itemSearch}`;
            url += "?" + new URLSearchParams({ ...this.filters, synthesisOnly: this.synthesisOnly }).toString();

            const res = await fetch(url);
            const items = await res.json();
            this.items = items.map((item) => {
                return { id: item.properties.item_id, name: item.properties.name_en };
            });
            Alpine.store("dropdown").items = this.items;
        },

        showSearchResults(e) {
            Alpine.store("dropdown").visible = true;
            Alpine.store("dropdown").right = window.innerWidth - e.target.getBoundingClientRect().right;
            Alpine.store("dropdown").top = e.target.getBoundingClientRect().bottom;
            Alpine.store("dropdown").items = this.items;
            Alpine.store("dropdown").click = (item) => {
                this.items = [];
                this[this.dataName] = item.id;
                this.itemSearch = item.name + "。";
                Alpine.store("dropdown").items = [];
            };
        },

        enterPress(e) {
            if (Alpine.store("dropdown").items.length !== 0) {
                Alpine.store("dropdown").clickItem();
            } else {
                this.submit();
            }
        }
    }));
});
